/**
 * jQuery plugin that processes the HTML content of selected elements,
 * formats each line using custom markup rules, and updates the element's HTML.
 *
 * @function
 * @returns {void}
 */
$.fn.formatMarkup = function () {
    var objects = $(this);
    for (var j = 0; j < objects.length; j++) {
        var _this = $(objects[j]);
        _this.data('textMarkup', _this.html());
        var text = _this.html().replace(/<br>\n/g, "\n").replace(/<br>/g, "\n").replace("<br />", "\n");
        var lines = text.split("\n");
        var html = '';
        if (lines.length == 1) {
            html = $.toMarkup(lines[0].trim());
        } else if (lines.length > 1) {
            var ulStart = false;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.charAt(0) == '-' && line.charAt(1) != '-') {
                    if (!ulStart) {
                        ulStart = true;
                        html += '<ul>';
                    }
                    line = line.substring(1).trim();
                    html += '<li>' + $.toMarkup(line) + '</li>';
                } else {
                    if (ulStart) {
                        ulStart = false;
                        html += '</ul>';
                    }
                    html += $.toMarkup(line) + '<br>';
                }
            }
            if (ulStart) {
                ulStart = false;
                html += '</ul>';
            }
        }

        _this.data('htmlMarkup', html);
        _this.html(html);
    }
}

/**
 * Builds an HTML anchor tag from a given URL with display text shortened for readability.
 *
 * @function
 * @param {string} encodedUrl - The URL-encoded string used as the href target.
 * @param {string} url - The original URL string used for the display text.
 * @returns {string} An HTML string containing the anchor element with icon and shortened text.
 */
$.linkBuilder = function (encodedUrl,url) {
    //encodedURL is used for creating the correct link. inputText is used to keep the link readable for the user
    if(encodedUrl.substr(0,3)==='www') {
        encodedUrl='https://'+encodedUrl;
    }
    return '<a href="' + encodedUrl + '" target="_blank"><i class="fa fa-external-link" aria-hidden="true"></i> ' + $.linkTextShorter(url) + '</a>';
}

/**
 * Finds the index of the n-th occurrence of a specified substring (pattern) within the string.
 *
 * @function
 * @name String.prototype.nthIndexOf
 * @param {string} pattern - The substring to search for.
 * @param {number} n - The occurrence number to find (1-based index).
 * @returns {number} The index of the n-th occurrence of the pattern, or -1 if not found.
 *
 */
String.prototype.nthIndexOf = function (pattern, n) {
    var i = -1;
    while (n-- && i++ < this.length) {
        i = this.indexOf(pattern, i);
        if (i < 0)
            break;
    }

    return i;
};

/**
 * Shortens a full URL into a more user-friendly string for display purposes.
 * - Strips the protocol and "www." prefix.
 * - Condenses long paths or query strings.
 * - Keeps the domain and highlights either the first query parameter or indicates truncated content.
 *
 * @function
 * @param {string} url - The full URL to be shortened.
 * @returns {string} A shortened, readable version of the URL.
 */
$.linkTextShorter = function (url) {
    // Extract the protocol and main domain, removing "www." if present
    const protocolIndex = url.indexOf("://");
    const mainDomainStart = protocolIndex > -1 ? protocolIndex + 3 : 0;
    const mainDomainEnd = url.indexOf("/", mainDomainStart);
    let mainDomain = url.substring(mainDomainStart, mainDomainEnd > -1 ? mainDomainEnd : url.length);

    // Remove "www." prefix if it exists
    if (mainDomain.startsWith("www.")) {
        mainDomain = mainDomain.slice(4);
    }

    // If URL has query parameters
    const queryIndex = url.indexOf("?");
    if (queryIndex > -1) {
        const queryParams = url.substring(queryIndex + 1);
        const keyValues = queryParams.split("&");

        // Pick the first query parameter to keep
        const firstParam = keyValues[0];
        return `${mainDomain}[...]?${firstParam}`;
    }

    // Handle longer URLs without query parameters
    const remainingUrl = url.substring(mainDomainEnd + 1);
    if (remainingUrl.length > 20 && url.indexOf("?")>0) {
        return `${mainDomain}/[...]`;
    }

    // Default to showing the main domain
    return mainDomain;
};

/**
 * Detects and converts URLs and email addresses in a text string into clickable HTML links.
 * - Supports Unicode characters in URLs (e.g., umlauts).
 * - Converts email addresses into `mailto:` links with an icon.
 *
 * @function
 * @param {string} inputText - The raw text containing URLs or email addresses.
 * @returns {string} The text with URLs and email addresses converted into HTML anchor tags.
 */
$.linkify = function (inputText) {
    //Regex-Pattern for URLs with Unicode support
    var replacePattern1 = /((\b(https?|ftp):\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;äöüßÄÖÜ()]*[a-z0-9äöüßÄÖÜ])/gim;
    inputText = inputText.replace(replacePattern1, function (url) {
        var encodedUrl = url.replace(/ä/g, '%C3%A4').replace(/ö/g, '%C3%B6').replace(/ü/g, '%C3%BC').replace(/ß/g, '%C3%9F').replace(/Ä/g, '%C3%84').replace(/Ö/g, '%C3%96').replace(/Ü/g, '%C3%9C');
        return $.linkBuilder(encodedUrl,inputText);
    });


    var mailformat = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    var mailadresses = inputText.match(mailformat);
    if (mailadresses !== null && mailadresses !== '') {

        for (let i = 0; i < mailadresses.length; i++) {
            inputText = inputText.replace(mailadresses[i], '<a href="mailto:' + mailadresses[i] + '"><i class="fa fa-at" aria-hidden="true"></i> ' + mailadresses[i] + '</a>');
        }
    }

    return inputText;
}

/**
 * Transforms plain text into HTML markup with support for inline formatting,
 * code blocks, hyperlinks, dates, times, and markdown-like syntax.
 *
 * @function
 * @param {string} text - The input text string to be transformed into markup.
 * @returns {string} The HTML-formatted string.
 */
$.toMarkup = function (text) {


    function stripWrappers(text) {
        const wrappers = ['\\*\\*', '__', '~~', '--', '#'];

        for (const w of wrappers) {
            const pattern = new RegExp(`^${w}\\s*(.*?)\\s*${w}$`);
            const match = text.match(pattern);
            if (match) {
                return match[1]; // gib den "entkernten" Inhalt zurück
            }
        }
        return text;
    }

    // Function to check if a part of text is a URL
    function isURL(part) {
        return /https?:\/\/|www\./.test(part);
    }
    // Function to check if a part of text is an E-Mail Address
    function isEmail(part) {
        return /@[^\s@]+\.[^\s@]+/.test(part);
    }

    //exlude code from all further formatting
    var inlineCodeRegex = /`([^`]+)`/;
    if (inlineCodeRegex.test(text)) {
        text = text.replace(inlineCodeRegex, function(match, code) {
            return "<code>" + code + "</code>";
        });
        return text;
    }

    //format URLs and Mail
    if(isURL(text) || isEmail(text)){
        return($.linkify(stripWrappers(text)));
    }

    //apply residual formatting
    text = text.replace(/(\d{2})([\/.-])(\d{2})\2(\d{4})/gm, '<i class="fa fa-calendar" aria-hidden="true"></i> $1$2$3$2$4');
    text = text.replace(/(\d{2})([\/.-])(\d{2})\2(\d{2})\b/gm, '<i class="fa fa-calendar" aria-hidden="true"></i> $1$2$3$2$4');
    // Time formatting
    text = text.replace(/(\d{2}):(\d{2})/g, '<i class="fa fa-clock-o" aria-hidden="true"></i> $1:$2');
    text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); // Bold
    text = text.replace(/__(.+?)__/g, "<u>$1</u>"); // Underline
    text = text.replace(/~~(.+?)~~/g, "<i>$1</i>"); // Italic
    text = text.replace(/--(.+?)--/g, "<del>$1</del>"); // Strikethrough
    text = text.replace(/#(.+?)#/g, "<h1>$1</h1>"); // Heading
    text = text.replace(/\_\((.+?)\)/g, "<sub>$1</sub>"); // Subscript
    text = text.replace(/_(.)(?= |$)/g, "<sub>$1</sub>");
    text = text.replace(/\^\((.+?)\)/g, "<sup>$1</sup>"); // Superscript
    text = text.replace(/\^(.+?)/g, "<sup>$1</sup>");

    return text;
};

$(document).ready(function () {
    $('.markup').formatMarkup();
});