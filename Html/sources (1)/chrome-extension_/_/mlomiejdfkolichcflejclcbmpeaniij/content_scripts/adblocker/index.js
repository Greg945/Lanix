(function () {
    'use strict';

    /*!
     * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
     *
     * This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at https://mozilla.org/MPL/2.0/.
     */
    const SCRIPT_ID = 'cliqz-adblocker-script';
    const IGNORED_TAGS = new Set(['br', 'head', 'link', 'meta', 'script', 'style', 's']);
    function debounce(fn, { waitFor, maxWait, }) {
        let delayedTimer;
        let maxWaitTimer;
        const clear = () => {
            clearTimeout(delayedTimer);
            clearTimeout(maxWaitTimer);
            delayedTimer = undefined;
            maxWaitTimer = undefined;
        };
        const run = () => {
            clear();
            fn();
        };
        return [
            () => {
                if (maxWaitTimer === undefined) {
                    maxWaitTimer = setTimeout(run, maxWait);
                }
                clearTimeout(delayedTimer);
                delayedTimer = setTimeout(run, waitFor);
            },
            clear,
        ];
    }
    function isElement(node) {
        // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType#node_type_constants
        return node.nodeType === 1; // Node.ELEMENT_NODE;
    }
    function getElementsFromMutations(mutations) {
        // Accumulate all nodes which were updated in `nodes`
        const elements = [];
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                if (isElement(mutation.target)) {
                    elements.push(mutation.target);
                }
            }
            else if (mutation.type === 'childList') {
                for (const addedNode of mutation.addedNodes) {
                    if (isElement(addedNode) && addedNode.id !== SCRIPT_ID) {
                        elements.push(addedNode);
                    }
                }
            }
        }
        return elements;
    }
    /**
     * WARNING: this function should be self-contained and not rely on any global
     * symbol. That constraint needs to be fulfilled because this function can
     * potentially be injected in content-script (e.g.: see PuppeteerBlocker for
     * more details).
     */
    function extractFeaturesFromDOM(roots) {
        // NOTE: This cannot be global as puppeteer needs to be able to serialize this function.
        const ignoredTags = new Set(['br', 'head', 'link', 'meta', 'script', 'style', 's']);
        const classes = new Set();
        const hrefs = new Set();
        const ids = new Set();
        const seenElements = new Set();
        for (const root of roots) {
            for (const element of [
                root,
                ...root.querySelectorAll('[id]:not(html):not(body),[class]:not(html):not(body),[href]:not(html):not(body)'),
            ]) {
                // If one of root belongs to another root which is parent node of the one, querySelectorAll can return duplicates.
                if (seenElements.has(element)) {
                    continue;
                }
                seenElements.add(element);
                // Any conditions to filter this element out should be placed under this line:
                if (ignoredTags.has(element.nodeName.toLowerCase())) {
                    continue;
                }
                // Update ids
                const id = element.getAttribute('id');
                if (typeof id === 'string') {
                    ids.add(id);
                }
                // Update classes
                const classList = element.classList;
                for (const classEntry of classList) {
                    classes.add(classEntry);
                }
                // Update href
                const href = element.getAttribute('href');
                if (typeof href === 'string') {
                    hrefs.add(href);
                }
            }
        }
        return {
            classes: Array.from(classes),
            hrefs: Array.from(hrefs),
            ids: Array.from(ids),
        };
    }
    class DOMMonitor {
        constructor(cb) {
            this.cb = cb;
            this.knownIds = new Set();
            this.knownHrefs = new Set();
            this.knownClasses = new Set();
            this.observer = null;
        }
        queryAll(window) {
            this.cb({ type: 'elements', elements: [window.document.documentElement] });
            this.handleUpdatedNodes([window.document.documentElement]);
        }
        start(window) {
            if (this.observer === null && window.MutationObserver !== undefined) {
                const nodes = new Set();
                const handleUpdatedNodesCallback = () => {
                    this.handleUpdatedNodes(Array.from(nodes));
                    nodes.clear();
                };
                const [debouncedHandleUpdatedNodes, cancelHandleUpdatedNodes] = debounce(handleUpdatedNodesCallback, {
                    waitFor: 25,
                    maxWait: 1000,
                });
                this.observer = new window.MutationObserver((mutations) => {
                    getElementsFromMutations(mutations).forEach(nodes.add, nodes);
                    // Set a threshold to prevent websites continuously
                    // causing DOM mutations making the set being filled up infinitely.
                    if (nodes.size > 512) {
                        cancelHandleUpdatedNodes();
                        handleUpdatedNodesCallback();
                    }
                    else {
                        debouncedHandleUpdatedNodes();
                    }
                });
                this.observer.observe(window.document.documentElement, {
                    // Monitor some attributes
                    attributes: true,
                    attributeFilter: ['class', 'id', 'href'],
                    childList: true,
                    subtree: true,
                });
            }
        }
        stop() {
            if (this.observer !== null) {
                this.observer.disconnect();
                this.observer = null;
            }
        }
        handleNewFeatures({ hrefs, ids, classes, }) {
            const newIds = [];
            const newClasses = [];
            const newHrefs = [];
            // Update ids
            for (const id of ids) {
                if (this.knownIds.has(id) === false) {
                    newIds.push(id);
                    this.knownIds.add(id);
                }
            }
            for (const cls of classes) {
                if (this.knownClasses.has(cls) === false) {
                    newClasses.push(cls);
                    this.knownClasses.add(cls);
                }
            }
            for (const href of hrefs) {
                if (this.knownHrefs.has(href) === false) {
                    newHrefs.push(href);
                    this.knownHrefs.add(href);
                }
            }
            if (newIds.length !== 0 || newClasses.length !== 0 || newHrefs.length !== 0) {
                this.cb({
                    type: 'features',
                    classes: newClasses,
                    hrefs: newHrefs,
                    ids: newIds,
                });
                return true;
            }
            return false;
        }
        handleUpdatedNodes(elements) {
            if (elements.length !== 0) {
                this.cb({
                    type: 'elements',
                    elements: elements.filter((e) => IGNORED_TAGS.has(e.nodeName.toLowerCase()) === false),
                });
                return this.handleNewFeatures(extractFeaturesFromDOM(elements));
            }
            return false;
        }
    }

    /*!
     * Based on parsel. Extended by Rémi Berson for Ghostery (2021).
     * https://github.com/LeaVerou/parsel
     *
     * MIT License
     *
     * Copyright (c) 2020 Lea Verou
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     */
    const TOKENS = {
        attribute: /\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(?<caseSensitive>[iIsS])?\s*)?\]/gu,
        id: /#(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,
        class: /\.(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,
        comma: /\s*,\s*/g, // must be before combinator
        combinator: /\s*[\s>+~]\s*/g, // this must be after attribute
        'pseudo-element': /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?:¶*)\))?/gu, // this must be before pseudo-class
        'pseudo-class': /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶*)\))?/gu,
        type: /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu, // this must be last
    };
    const TOKENS_WITH_PARENS = new Set(['pseudo-class', 'pseudo-element']);
    new Set([...TOKENS_WITH_PARENS, 'attribute']);
    const TOKENS_FOR_RESTORE = Object.assign({}, TOKENS);
    TOKENS_FOR_RESTORE['pseudo-element'] = RegExp(TOKENS['pseudo-element'].source.replace('(?<argument>¶*)', '(?<argument>.*?)'), 'gu');
    TOKENS_FOR_RESTORE['pseudo-class'] = RegExp(TOKENS['pseudo-class'].source.replace('(?<argument>¶*)', '(?<argument>.*)'), 'gu');

    /*!
     * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
     *
     * This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at https://mozilla.org/MPL/2.0/.
     */
    /**
     * Evaluates an XPath expression and returns matching Element nodes.
     * @param element - The context element for XPath evaluation
     * @param xpathExpression - The XPath expression to evaluate
     * @returns Array of Element nodes that match the XPath expression
     */
    function handleXPathSelector(element, xpathExpression) {
        try {
            if (typeof Node === 'undefined' || typeof XPathResult === 'undefined') {
                return []; // unsupported (not running in the browser)
            }
            const result = element.ownerDocument.evaluate(xpathExpression, element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (result.resultType !== XPathResult.ORDERED_NODE_SNAPSHOT_TYPE) {
                return [];
            }
            const elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                const node = result.snapshotItem(i);
                if ((node === null || node === void 0 ? void 0 : node.nodeType) === Node.ELEMENT_NODE) {
                    elements.push(node);
                }
            }
            return elements;
        }
        catch (e) {
            return [];
        }
    }
    function parseCSSValue(cssValue) {
        const firstColonIndex = cssValue.indexOf(':');
        if (firstColonIndex === -1) {
            throw new Error('Invalid CSS value format: no colon found');
        }
        const property = cssValue.slice(0, firstColonIndex).trim();
        const value = cssValue.slice(firstColonIndex + 1).trim();
        const isRegex = value.startsWith('/') && value.lastIndexOf('/') > 0;
        return { property, value, isRegex };
    }
    function matchCSSProperty(element, cssValue, pseudoElement) {
        const { property, value, isRegex } = parseCSSValue(cssValue);
        const win = element.ownerDocument && element.ownerDocument.defaultView;
        if (!win)
            throw new Error('No window context for element');
        const computedStyle = win.getComputedStyle(element, pseudoElement);
        const actualValue = computedStyle[property];
        if (isRegex) {
            const regex = parseRegex(value);
            return regex.test(actualValue);
        }
        return actualValue === value;
    }
    function parseRegex(str) {
        if (str.startsWith('/') && str.lastIndexOf('/') > 0) {
            const lastSlashIndex = str.lastIndexOf('/');
            const pattern = str.slice(1, lastSlashIndex);
            const flags = str.slice(lastSlashIndex + 1);
            if (!/^[gimsuyd]*$/.test(flags)) {
                throw new Error(`Invalid regex flags: ${flags}`);
            }
            return new RegExp(pattern, flags);
        }
        else {
            return new RegExp(str);
        }
    }
    function stripsWrappingQuotes(str) {
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        return str;
    }
    function matchPattern(pattern, text) {
        pattern = stripsWrappingQuotes(pattern);
        // TODO - support 'm' RegExp argument
        if (pattern.startsWith('/') && (pattern.endsWith('/') || pattern.endsWith('/i'))) {
            let caseSensitive = true;
            pattern = pattern.slice(1);
            if (pattern.endsWith('/')) {
                pattern = pattern.slice(0, -1);
            }
            else {
                pattern = pattern.slice(0, -2);
                caseSensitive = false;
            }
            return new RegExp(pattern, caseSensitive === false ? 'i' : undefined).test(text);
        }
        return text.includes(pattern);
    }
    /**
     * Checks if the given element complies with the given selector.
     * @param element The subjective element.
     * @param selector The selector.
     */
    function matches(element, selector) {
        var _a;
        if (selector.type === 'id' ||
            selector.type === 'class' ||
            selector.type === 'type' ||
            selector.type === 'attribute') {
            return element.matches(selector.content);
        }
        else if (selector.type === 'list') {
            return selector.list.some((s) => matches(element, s));
        }
        else if (selector.type === 'compound') {
            // Compound selectors contain only simple selectors (id, class, type, attribute, pseudo-class)
            // that must all match the same element. Complex selectors (with combinators like >, +, ~)
            // are processed at a higher level by the parser, so they can never be children of compound selectors.
            return selector.compound.every((s) => matches(element, s));
        }
        else if (selector.type === 'pseudo-class') {
            if (selector.name === 'has') {
                // The subjective element of `:has` check may be the given element or its children:
                // - e.g. `html:has(body)`, `body` is the expected subjective to be filtered by `traverse`.
                // - e.g. `html:has(>body)`, `html` is the subjective element to be filtered by `branch` then `traverse`.
                // `querySelectorAll` already describes the all.
                return (selector.subtree !== undefined && querySelectorAll(element, selector.subtree).length !== 0);
            }
            else if (selector.name === 'not') {
                // Unlike `:has`, `:not` assumes the subtree to be the condition for the given element.
                return selector.subtree !== undefined && traverse(element, [selector.subtree]).length === 0;
            }
            else if (selector.name === 'has-text') {
                const { argument } = selector;
                if (argument === undefined) {
                    return false;
                }
                const text = element.textContent;
                if (text === null) {
                    return false;
                }
                return matchPattern(argument, text.trim());
            }
            else if (selector.name === 'min-text-length') {
                const minLength = Number(selector.argument);
                if (Number.isNaN(minLength) || minLength < 0) {
                    return false;
                }
                const text = element.textContent;
                if (text === null) {
                    return false;
                }
                return text.length >= minLength;
            }
            else if (selector.name === 'matches-path') {
                const { argument } = selector;
                if (argument === undefined) {
                    return false;
                }
                const window = (_a = element.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
                if (!window) {
                    return false;
                }
                // Get both pathname and search (query parameters)
                const path = window.location.pathname;
                const search = window.location.search;
                const fullUrl = path + search;
                const regex = parseRegex(argument);
                return regex.test(fullUrl);
            }
            else if (selector.name === 'matches-attr') {
                const { argument } = selector;
                if (argument === undefined) {
                    return false;
                }
                const indexOfEqual = argument.indexOf('=');
                let namePattern;
                let valuePattern;
                if (indexOfEqual === -1) {
                    namePattern = argument;
                }
                else {
                    namePattern = argument.slice(0, indexOfEqual);
                    valuePattern = argument.slice(indexOfEqual + 1);
                }
                namePattern = stripsWrappingQuotes(namePattern);
                valuePattern = valuePattern ? stripsWrappingQuotes(valuePattern) : undefined;
                let valueRegex = null;
                if ((valuePattern === null || valuePattern === void 0 ? void 0 : valuePattern.startsWith('/')) && valuePattern.lastIndexOf('/') > 0) {
                    valueRegex = parseRegex(valuePattern);
                }
                if (namePattern.startsWith('/') && namePattern.lastIndexOf('/') > 0) {
                    // matching attribute name by regex
                    const regex = parseRegex(namePattern);
                    const matchingAttrs = [...element.attributes].filter((attr) => regex.test(attr.name));
                    // If no value pattern, return true if any attribute matches the name pattern
                    if (!valuePattern) {
                        return matchingAttrs.length > 0;
                    }
                    // Check if any of the matching attributes have the specified value
                    return matchingAttrs.some((attr) => valueRegex ? valueRegex.test(attr.value) : attr.value === valuePattern);
                }
                else {
                    // matching attribute name by string
                    const value = element.getAttribute(namePattern);
                    // null means the attribute is not present
                    if (value === null) {
                        return false;
                    }
                    // early exit if no value pattern is provided
                    if (!valuePattern) {
                        return true;
                    }
                    return valueRegex ? valueRegex.test(value) : value === valuePattern;
                }
            }
            else if (selector.name === 'matches-css') {
                return selector.argument !== undefined && matchCSSProperty(element, selector.argument);
            }
            else if (selector.name === 'matches-css-after') {
                return (selector.argument !== undefined && matchCSSProperty(element, selector.argument, '::after'));
            }
            else if (selector.name === 'matches-css-before') {
                return (selector.argument !== undefined && matchCSSProperty(element, selector.argument, '::before'));
            }
        }
        return false;
    }
    /**
     * Describes CSS combinator behaviors from the given element.
     * @param element The current subjective element.
     * @param selector A complex selector.
     */
    function handleComplexSelector(element, selector) {
        // The *left* part of the given selector is not queried by the previous step.
        // If there's no *left* part, we fallback to the current element.
        const leftElements = selector.left === undefined ? [element] : querySelectorAll(element, selector.left);
        // The *right* part of the given selector is always *singular*.
        // The understanding of `compound` selector behavior differs by `match` and `querySelectorAll`.
        // The `compound` handler in `querySelectorAll` assume the subjective to be queried.
        // However, our *actual* subjective elements are coming from *left* part of the selector.
        // Therefore, we unmarshal the `compound` selector and directly use `traversal` which will involve `compound` handling in `match`.
        const selectors = selector.right.type === 'compound' ? selector.right.compound : [selector.right];
        const results = new Set();
        switch (selector.combinator) {
            case ' ':
                // Look for all children *in any depth* of the all `leftElements` and filter them by `traversal`.
                for (const leftElement of leftElements) {
                    for (const child of leftElement.querySelectorAll('*')) {
                        for (const result of traverse(child, selectors)) {
                            results.add(result);
                        }
                    }
                }
                break;
            case '>':
                // Look for all children of the all `leftElements` and filter them by `traversal`.
                for (const leftElement of leftElements) {
                    for (const child of leftElement.children) {
                        for (const result of traverse(child, selectors)) {
                            results.add(result);
                        }
                    }
                }
                break;
            case '~':
                // Look for all siblings of the all `leftElements` and filter them by `traversal`.
                for (const leftElement of leftElements) {
                    let sibling = leftElement;
                    while ((sibling = sibling.nextElementSibling) !== null) {
                        for (const result of traverse(sibling, selectors)) {
                            results.add(result);
                        }
                    }
                }
                break;
            case '+':
                // Look for a next sibiling of the all `leftElements` and filter them by `traversal`.
                for (const leftElement of leftElements) {
                    if (leftElement.nextElementSibling === null) {
                        continue;
                    }
                    for (const result of traverse(leftElement.nextElementSibling, selectors)) {
                        results.add(result);
                    }
                }
                break;
        }
        return Array.from(results);
    }
    /**
     * Transposes the given element with a selector.
     * @param element The subjective element
     * @param selector A selector
     * @returns An array of elements or null if not a transpose operator.
     */
    function transpose(element, selector) {
        if (selector.type === 'pseudo-class') {
            if (selector.name === 'upward') {
                if (selector.argument === undefined) {
                    return [];
                }
                const argument = stripsWrappingQuotes(selector.argument);
                let parentElement = element;
                let number = Number(argument);
                if (Number.isInteger(number)) {
                    if (number <= 0 || number >= 256) {
                        return [];
                    }
                    while ((parentElement = parentElement.parentElement) !== null) {
                        if (--number === 0) {
                            return [parentElement];
                        }
                    }
                }
                else {
                    while ((parentElement = parentElement.parentElement) !== null) {
                        if (parentElement.matches(argument)) {
                            return [parentElement];
                        }
                    }
                }
                return [];
            }
            else if (selector.name === 'xpath') {
                if (selector.argument === undefined) {
                    return [];
                }
                return handleXPathSelector(element, selector.argument);
            }
        }
        return null;
    }
    /**
     * Checks elements by traversing from the given element.
     * You need to decide the subjective element candidates manually.
     * It doesn't look for the children of the given element.
     * @param root The subjective element.
     * @param selectors The selector list to validate with.
     * @returns If the given element and all followed candidate fails, it returns an empty array.
     */
    function traverse(root, selectors) {
        if (selectors.length === 0) {
            return [];
        }
        const traversals = [{ element: root, index: 0 }];
        const results = [];
        while (traversals.length) {
            const traversal = traversals.pop();
            const { element } = traversal;
            let { index } = traversal;
            for (; index < selectors.length; index++) {
                const candidates = transpose(element, selectors[index]);
                const isTransposeOperator = candidates !== null;
                if (isTransposeOperator) {
                    traversals.push(...candidates.map((element) => ({ element, index: index + 1 })));
                    break;
                }
                else if (matches(element, selectors[index]) === false) {
                    // no maches found - stop processing the branch
                    break;
                }
            }
            // Check if the loop was completed
            if (index === selectors.length && !results.includes(element)) {
                results.push(element);
            }
        }
        return results;
    }
    function querySelectorAll(element, selector) {
        // Type of `attribute`, `class`, `id`, and `type` are to express simple selectors.
        // e.g. `[attr]` is `attribute` type, `.cls` is `class` type, `#lure` is `id` type, and `div` is `type` type.
        if (selector.type === 'id' ||
            selector.type === 'class' ||
            selector.type === 'type' ||
            selector.type === 'attribute') {
            return Array.from(element.querySelectorAll(selector.content));
        }
        // Type of `list` is sets of selector trees.
        // We just join all the results.
        // e.g. `p, span`
        if (selector.type === 'list') {
            const results = [];
            for (const item of selector.list) {
                for (const result of querySelectorAll(element, item)) {
                    if (!results.includes(result)) {
                        results.push(result);
                    }
                }
            }
            return results;
        }
        // Type of `compound` is a set of consecutive selectors.
        // They're in chained form like `p:has(span)` and works as logical AND.
        if (selector.type === 'compound') {
            const results = [];
            const [first, ...rest] = selector.compound;
            for (const subjective of querySelectorAll(element, first)) {
                for (const result of traverse(subjective, rest)) {
                    if (!results.includes(result)) {
                        results.push(result);
                    }
                }
            }
            return results;
        }
        // Type of `complex` is used to express CSS combinators: ` `, `>`, `+`, `~`.
        // The `branch` function describes the behavior per combinator.
        if (selector.type === 'complex') {
            return handleComplexSelector(element, selector);
        }
        if (selector.type === 'pseudo-class') {
            const results = [];
            // This code is intended to be matched with `document.documentElement.querySelectorAll`.
            // Since `document` is at the higher position rather `document.documentElement`,
            // it can't select `html` for an instance.
            for (const subjective of element.querySelectorAll('*')) {
                for (const result of traverse(subjective, [selector])) {
                    if (!results.includes(result)) {
                        results.push(result);
                    }
                }
            }
            return results;
        }
        return [];
    }

    /*!
     * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
     *
     * This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at https://mozilla.org/MPL/2.0/.
     */
    var SelectorType;
    (function (SelectorType) {
        SelectorType[SelectorType["Normal"] = 0] = "Normal";
        SelectorType[SelectorType["Extended"] = 1] = "Extended";
        SelectorType[SelectorType["Invalid"] = 2] = "Invalid";
    })(SelectorType || (SelectorType = {}));

    /**
     * Ghostery Browser Extension
     * https://www.ghostery.com/
     *
     * Copyright 2017-present Ghostery GmbH. All rights reserved.
     *
     * This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at http://mozilla.org/MPL/2.0
     */


    let UPDATE_EXTENDED_TIMEOUT = null;
    const PENDING = new Set();
    const EXTENDED = new Map();
    const HIDDEN = new Map();

    function cachedQuerySelector(root, selector, cache) {
      // First check if we have a result in cache for this node and selector
      const cachedElements = cache.get(root)?.get(selector);
      if (cachedElements !== undefined) {
        return cachedElements;
      }

      const selected = new Set(querySelectorAll(root, selector.ast));

      // Cache result for next time!
      if (selector.attribute !== undefined) {
        let cachedSelectors = cache.get(root);
        if (cachedSelectors === undefined) {
          cachedSelectors = new Map();
          cache.set(root, cachedSelectors);
        }
        cachedSelectors.set(selector, selected);
      }

      return selected;
    }

    function updateExtended() {
      if (PENDING.size === 0 || EXTENDED.size === 0) {
        return;
      }

      const cache = new Map();

      const elementsToHide = new Map();

      // Since we are processing elements in a delayed fashion, it is possible
      // that some short-lived DOM nodes are already detached. Here we simply
      // ignore them.
      const roots = [...PENDING].filter((e) => e.isConnected === true);
      PENDING.clear();

      for (const root of roots) {
        for (const selector of EXTENDED.values()) {
          for (const element of cachedQuerySelector(root, selector, cache)) {
            if (selector.remove === true) {
              element.textContent = '';
              element.remove();
            } else if (
              selector.attribute !== undefined &&
              HIDDEN.has(element) === false
            ) {
              elementsToHide.set(element, { selector, root });
            }
          }
        }
      }

      // Hide new nodes if any
      for (const [element, { selector, root }] of elementsToHide.entries()) {
        if (selector.attribute !== undefined) {
          element.setAttribute(selector.attribute, '');
          HIDDEN.set(element, { selector, root });
        }
      }

      // Check if some elements should be un-hidden.
      for (const [element, { selector, root }] of [...HIDDEN.entries()]) {
        if (selector.attribute !== undefined) {
          if (
            root.isConnected === false ||
            element.isConnected === false ||
            cachedQuerySelector(root, selector, cache).has(element) === false
          ) {
            HIDDEN.delete(element);
            element.removeAttribute(selector.attribute);
          }
        }
      }
    }

    /**
     * Queue `elements` to be processed asynchronously in a batch way (for
     * efficiency). This is important to not do more work than necessary, for
     * example if the same set of nodes is updated multiple times in a raw on
     * user-interaction (e.g. a dropdown); this allows to only check these nodes
     * once, and to not block the UI.
     */
    function delayedUpdateExtended(elements) {
      // If we do not have any extended filters applied to this frame, then we do
      // not need to do anything. We just ignore.
      if (EXTENDED.size === 0) {
        return;
      }

      // If root DOM element is already part of PENDING, no need to queue other elements.
      if (PENDING.has(window.document.documentElement)) {
        return;
      }

      // Queue up new elements into the global PENDING set, which will be processed
      // in a batch maner from a setTimeout.
      for (const element of elements) {
        // If we get the DOM root then we can clear everything else from the queue
        // since we will be looking at all nodes anyway.
        if (element === window.document.documentElement) {
          PENDING.clear();
          PENDING.add(element);
          break;
        }

        PENDING.add(element);
      }

      // Check if we need to trigger a setTimeout to process pending elements.
      if (UPDATE_EXTENDED_TIMEOUT === null) {
        UPDATE_EXTENDED_TIMEOUT = setTimeout(() => {
          UPDATE_EXTENDED_TIMEOUT = null;
          updateExtended();
        }, 1000);
      }
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'evaluateExtendedSelectors') {
        if (msg.extended && msg.extended.length > 0) {
          for (const selector of msg.extended) {
            EXTENDED.set(selector.id || JSON.stringify(selector.ast), selector);
          }
          delayedUpdateExtended([window.document.documentElement]);
        }
      }
    });

    /**
     * Ghostery Browser Extension
     * https://www.ghostery.com/
     *
     * Copyright 2017-present Ghostery GmbH. All rights reserved.
     *
     * This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at http://mozilla.org/MPL/2.0
     */


    document.addEventListener(
      'DOMContentLoaded',
      () => {
        const DOM_MONITOR = new DOMMonitor((update) => {
          if (update.type === 'elements') {
            if (update.elements.length !== 0) {
              delayedUpdateExtended(update.elements);
            }
          } else {
            chrome.runtime.sendMessage({
              ...update,
              action: 'injectCosmetics',
            });
          }
        });

        DOM_MONITOR.queryAll(window);

        DOM_MONITOR.start(window);
      },
      { once: true, passive: true },
    );

})();
