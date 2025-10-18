'use strict'

        + function () {
            if (!('serviceWorker' in navigator)) {
                return
            }

            if (navigator.serviceWorker.controller) {
                return
            }

            navigator.serviceWorker
                   .register('./js/serviceworker.js', { scope: './js/' })
                    .catch(function (err) {
                        console.error('ServiceWorker has not been registered!', err);
                    })
        }()