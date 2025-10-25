/**
 * PaedOrg classes/functions.
 *
 * @requires jQuery
 */

window.PaedOrg = window.PaedOrg || {};

((scope, $) => {

    //<editor-fold desc="UUID class">

    /**
     * @namespace PaedOrg
     * @class UUID
     */
    scope.PaedOrg.UUID = {

        /**
         * Generates UUID.
         *
         * @returns {string}
         */
        generate: () => {
            let d = new Date().getTime();
            if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
                d += performance.now(); //use high-precision timer if available
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-xxxxxx3xx'.replace(/[xy]/g, function (c) {
                const r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });            
        },

        /**
         * Generates UUID v4.
         *
         * @returns {string}
         */
        generateV4: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

    };

    //</editor-fold>


    //<editor-fold desc="Response class">

    /**
     * Ajax response class.
     * Supports JSON response like:
     * - `{'status': int, 'data': mixed}`.
     *
     * @namespace PaedOrg
     * @class Response
     */
    class Response
    {
        /**
         * @param {String|Object} responseData
         */
        constructor(responseData)
        {
            this.responseData = responseData;

            // Initialize response
            if ($.type(this.responseData) === 'string') {
                try {
                    this.response = JSON.parse(this.responseData);
                } catch (e) {
                    this.response = this._createErrorResponse({detail: e.message});
                }
            } else if ($.type(this.responseData) === 'object' && $.type(this.responseData) !== null) {
                this.response = this.responseData;
            } else {
                this.response = this._createErrorResponse();
            }

            this.status = this.response?.status || 0;
            this.data = this.response?.data || {};

            if (this.isError()) {
                // Takeover some response values to data property, We need this to normalize ajax success
                // and ajax error responses.
                const keysToIgnore = ['status', 'data'];
                Object.keys(this.response).forEach(name => {
                    if (!keysToIgnore.includes(name) && $.type(this.data[name]) === 'undefined') {
                        this.data[name] = this.response[name];
                    }
                });
            }
        }

        getStatus()
        {
            return this.status;
        }

        isSuccess()
        {
            return this.getStatus() === 200;
        }

        isError()
        {
            return this.isClientError() || this.isServerError();
        }

        isClientError()
        {
            return this.getStatus() >= 400 && this.getStatus() < 500;
        }

        isServerError()
        {
            return this.getStatus() >= 500 && this.getStatus() < 600;
        }

        hasData()
        {
            if (typeof this.data === 'object' && this.data !== null) {
                return Object.keys(this.data).length > 0;
            }

            return this.data !== null && this.data !== '';
        }

        getData(key, defaultValue = null)
        {
            if (!key) {
                return this.data;
            }

            return $.type(this.data[key]) !== 'undefined' ? this.data[key] : defaultValue;
        }

        _createErrorResponse(options)
        {
            return {
                status: options.status || 400,
                title: options.title || 'Fehler',
                detail: options.detail || 'Unbekannter Fehler',
            }
        }
    }

    scope.PaedOrg.Response = Response;

    //</editor-fold>

    //<editor-fold desc="Response class">

    /**
     * Ajax legacy response class.
     * Supports JSON response like:
     * - `{'error': int, 'errortext': 'Error message'}`.
     * - `{'error': bool, string: mixed}`.
     *
     * @namespace PaedOrg
     * @class LegacyResponse
     */
    class LegacyResponse extends Response
    {
        /**
         * @param {XMLHttpRequest} xhr
         */
        constructor(xhr)
        {
            super(xhr.responseText);
            this.xhr = xhr;
            if (!this.isError()) {
                this.status = xhr.status;
                this.data = this.response || {};
            }
        }
    }

    scope.PaedOrg.LegacyResponse = LegacyResponse;

    //</editor-fold>

    //<editor-fold desc="Footer notification class">

    /**
     * Footer notification class.
     * @namespace PaedOrg
     * @class FooterNotification
     */
    class FooterNotification
    {

        constructor()
        {
            this.$root = this._getNotification();
            this.$success = this.$root.find('.alert-success');
            this.$info = this.$root.find('.alert-info');
            this.$warning = this.$root.find('.alert-warning');
            this.$error = this.$root.find('.alert-danger');
            this.delayTimer = {
                success: null,
                info: null,
                warning: null,
                danger: null,
            };
        }

        showSuccess(options)
        {
            const _options = Object.assign({}, options);
            _options.delay = _options.delay || 2000;
            this._showNotification(this.$success, _options);
        }

        showInfo(options)
        {
            const _options = Object.assign({}, options);
            _options.delay = _options.delay || 2000;
            this._showNotification(this.$info, _options);
        }

        showWarning(options)
        {
            const _options = Object.assign({}, options);
            _options.delay = _options.delay || 3000;
            this._showNotification(this.$warning, _options);
        }

        /**
         * @param options
         * @deprecated Use showWarning()
         */
        showAlert(options)
        {
            this.showWarning(options);
        }

        showError(options)
        {
            const _options = Object.assign({}, options);
            _options.delay = _options.delay || 3000;
            this._showNotification(this.$error, _options);
        }

        /** @private */
        _showNotification($element, options)
        {
            options.message = options.message || $element.data('message');
            options.callback = options.callback || function () {};

            $element.html(options.message);

            const type = $element.data('type');
            if (this.delayTimer[type]) {
                clearTimeout(this.delayTimer[type]);
                this.delayTimer[type] = null;
            }

            this._hideAll();

            $element.show();
            this.delayTimer[type] = setTimeout(function () {
                $element.fadeOut({
                    complete: function () {
                        $element.html('');
                        options.callback();
                    }
                });
            }, options.delay);
        }

        /** @private */
        _hideAll()
        {
            this.$success.hide();
            this.$info.hide();
            this.$warning.hide();
            this.$error.hide();
        }

        /** @private */
        _getNotification()
        {
            let $element = $('#footer-notification');
            if ($element.length > 0) {
                return $element;
            }

            const successMsg = 'Erfolgreich gespeichert!';
            const infoMsg = 'Information!';
            const warningMsg = 'Warnung!';
            const errorMsg = 'Leider ist beim Speichern ein Fehler aufgetreten!<br/>Bitte laden Sie die Seite neu!';

            $element = $(`
                <div id="footer-notification">
                    <div class="alert alert-success alert-footer-notification" data-type="success" data-message="${successMsg}">
                    </div>
                    <div class="alert alert-info alert-footer-notification" data-type="info" data-message="${infoMsg}">
                    </div>
                    <div class="alert alert-warning alert-footer-notification" data-type="warning" data-message="${warningMsg}">
                    </div>
                    <div class="alert alert-danger alert-footer-notification" data-type="danger" data-message="${errorMsg}">
                    </div>
                </div>
            `);
            $('body').append($element);

            return $element;
        }

    }

    scope.PaedOrg.FooterNotification = FooterNotification;

    //</editor-fold>

    //<editor-fold desc="Page reload class">

    /**
     * Page reload class.
     * 
     * @namespace PaedOrg
     * @class PageReload
     */
    class PageReload
    {

        /**
         * Constructor.
         *
         * @param {String} method Request method, either 'get' or 'post'.
         *      The method 'post' can be used as an alternative to `window.location.reload()`,
         *      since a post method invalidates the Varnish cache of current page!
         * @param {Object} parameter Additional parameter to add to the request.
         */
        constructor(method = 'get', parameter = {})
        {
            this.$root = $('body');
            this.method = method === 'get' ? 'get' : 'post';
            this.parameter = parameter;
            this.$form = this.$root.find('form#page-reload');
            if (!this.$form.length) {
                this.$form = $('<form/>', {id: 'page-reload', method: this.method});
                this.$root.append(this.$form);
            }
        }

        reload()
        {
            if (this.method === 'get') {
                this._reloadGet();
            } else {
                this._reloadPost();
            }
        }

        _reloadGet()
        {
            if (!$.isEmptyObject(this.parameter)) {
                const url = new URL(window.location.href);
                const searchParams = new URLSearchParams(url.search);
                $.each(this.parameter, function (name, value) {
                    searchParams.set(name, value);
                });
                url.search = searchParams.toString();
                window.location.href = url.toString();
            } else {
                window.location.reload();
            }
        }

        _reloadPost()
        {
            this.$form.attr('action', window.location.pathname + window.location.search);
            this.$form.html('');
            this.parameter.page_reload = 1;
            $.each(this.parameter, function (name, value) {
                const $input = $('<input/>', {type: 'hidden', name: name, value: value});
                this.$form.append($input);
            }.bind(this));
            this.$form.submit();
        }

    }

    scope.PaedOrg.PageReload = PageReload;

    //</editor-fold>

})(window, jQuery);