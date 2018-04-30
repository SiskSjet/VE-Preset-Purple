Number.prototype.pad = function (size) {
    let s = String(this);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
};

const images = [];
const modal = document.getElementById("image-modal");
const slider = document.getElementById("image-slider");
const numberText = slider.getElementsByClassName("number-text")[0];
const compareWidget = slider.getElementsByClassName("comparison-container")[0]
const imageElements = compareWidget.querySelectorAll('.comparison-image');
const vanillaSecSwitch = document.getElementById("vanilla-sec-switch");
const loader = document.getElementById("loader");
let current = 0;
let loaded = -1;

modal.addEventListener("click", function (e) {
    e = window.event || e;
    if(this === e.target) {
        closeModal();
    }
});

imageElements[0].addEventListener("load", imageLoaded);
imageElements[1].addEventListener("load", imageLoaded);

function imageLoaded() {
    loaded++;

    if (loaded == 1) {
        loader.style.display = "none";
        window.dispatchEvent(new Event('resize'));
    }
}

function showLoader() {
    loader.style.display = "block";
}

function openModal() {
    modal.style.display = "block";
}

function closeModal() {
    modal.style.display = "none";
}

function next() {
    setSlide(current + 1);
}

function prev() {
    setSlide(current - 1);
}

function setSlide(id) {
    if (id > images.length - 1) { id = 0 }
    if (id < 0) { id = images.length - 1 }
    current = id;
    numberText.textContent = `${id}/${images.length}`;

    loaded = -1;
    if (vanillaSecSwitch.checked) {
        imageElements[0].src = "img/" + images[id] + ".sec.png";
    } else {
        imageElements[0].src = "img/" + images[id] + ".vanilla.png";
    }
    
    imageElements[1].src = "img/" + images[id] + ".sec.d.png";

    showLoader();
}

function switchVanillaSec() {
    if (vanillaSecSwitch.checked) {
        imageElements[0].src = "img/" + images[current] + ".sec.png";
    } else {
        imageElements[0].src = "img/" + images[current] + ".vanilla.png";
    }

    if (loaded > 0) {
        loaded--;
    }
    
    showLoader();
}

function createImageTags() {
    const columns = 4;
    const es = 11;
    const ss = 22;
    const row = document.getElementsByClassName("row")[0];

    for (let index = 1; index < es + 1; index++) {
        const image = "es." + index.pad(2);
        images.push(image);
    }

    for (let index = 1; index < ss + 1; index++) {
        const image = "ss." + index.pad(2);
        images.push(image);
    }

    for (let index = 1; index < columns + 1; index++) {
        const column = document.createElement("div");
        column.className = "column";
        row.appendChild(column);
    }

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const column = (i % columns);
        const img = document.createElement("img");
        img.src = "img/thumb/" + image + ".sec.d.png";
        img.className = "hover-shadow cursor";
        img.setAttribute("data-loading", "true");
        img.setAttribute("onclick", `openModal(); setSlide(${i})`);
        img.onload = function() {
            img.removeAttribute('data-loading');
          };
        document.getElementsByClassName("column")[column].appendChild(img);
    }
}

function domReady() {
    createImageTags();
    new ImageComparison({
        container: compareWidget,
        startPosition: 30,
        data: [
            {
                image: imageElements[0],
                label: 'before'
            },
            {
                image: imageElements[1],
                label: 'after'
            }
        ],
    });
}

document.addEventListener('DOMContentLoaded', domReady);

/*
 * ImageComparison: Slider to quickly compare two images.
 *
 * By Max Ulyanov
 * Src: https://github.com/M-Ulyanov/ImageComparison/
 * Example https://m-ulyanov.github.io/image-comparison/
 */

(function (root) {

    const defaultOptions = {
        container: null,
        startPosition: 50,
        data: null
    };


    /**
     * Constructor
     * @param options
     */
    function ImageComparison(options) {
        this.options = utils.extend({}, [defaultOptions, options], {
            clearEmpty: true
        });
        this.container = this.options.container;
        this.images = [this.options.data[0].image, this.options.data[1].image];
        this.labels = [this.options.data[0].label, this.options.data[1].label];
        this._animateInterval = null;
        this._comparisonSeparator = null;
        this._items = [];

        if (this.container == null) {
            console.error('Container element not found!')
        }

        if (!this.images[0] || !this.images[1]) {
            console.error('Need two images!')
        }

        this._build();
        this._setEvents();
    }


    /**
     * Build HTML structure
     * @private
     */
    ImageComparison.prototype._build = function () {
        this.options.container.classList.add('comparison-widget');
        for (var i = 0; i < 2; i++) {
            var item = document.createElement('div');
            item.classList.add('comparison-item');

            var content = document.createElement('div');
            content.classList.add('comparison-item__content');
            if (this.labels[i]) {
                content.innerHTML = '<div class="comparison-item__label">' + this.labels[i] + '</div>';
            }
            this.images[i].classList.add('comparison-item__image');
            content.appendChild(this.images[i]);
            item.appendChild(content);

            if (i === 0) {
                item.classList.add('comparison-item--first');
                item.style.width = this.options.startPosition + '%';
                this._comparisonSeparator = document.createElement('div');
                this._comparisonSeparator.classList.add('comparison-separator');
                this._comparisonSeparator.innerHTML = '<div class="comparison-control"><div class="comparison-control__mask"></div></div>';
                item.appendChild(this._comparisonSeparator);
            }

            this._items.push(item);
            this.container.appendChild(item);
        }

    };


    /**
     * Set need DOM events
     * @private
     */
    ImageComparison.prototype._setEvents = function () {
        var comparison = this;

        comparison.container.addEventListener('click', function (event) {
            comparison._calcPosition(event);
        });

        utils.setMultiEvents(comparison._comparisonSeparator, ['mousedown', 'touchstart'], function () {
            comparison._comparisonSeparator.classList.add('actived');
        });

        utils.setMultiEvents(document.body, ['mouseup', 'touchend'], function () {
            comparison._comparisonSeparator.classList.remove('actived');
        });

        utils.setMultiEvents(document.body, ['mousemove', 'touchmove'], function (event) {
            if (comparison._comparisonSeparator.classList.contains('actived')) {
                comparison._calcPosition(event);
                if (document['selection']) {
                    document['selection'].empty();
                }
            }
        });

        utils.setMultiEvents(window, ['resize', 'load'], function () {
            comparison._setImageSize();
        });

        for (var i = 0; i < comparison.images.length; i++) {
            comparison.images[i].addEventListener('dragstart', function (e) {
                e.preventDefault();
            });
        }

    };


    /**
     * Calc current position (click, touch or move)
     * @param event
     * @private
     */
    ImageComparison.prototype._calcPosition = function (event) {
        var containerCoords = this.container.getBoundingClientRect();
        var containerWidth = containerCoords.width;
        /** @namespace event.touches */
        var horizontalPositionForElement = (event.clientX || event.touches[0].pageX) - containerCoords.left;
        var positionInPercent = horizontalPositionForElement * 100 / containerWidth;
        if (positionInPercent > 100) {
            positionInPercent = 100;
        }
        else if (positionInPercent < 0) {
            positionInPercent = 0;
        }
        this._controllerPosition(positionInPercent.toFixed(2), event.type);
    };


    /**
     * Controller position
     * @param positionInPercent
     * @param eventType
     * @private
     */
    ImageComparison.prototype._controllerPosition = function (positionInPercent, eventType) {
        switch (eventType) {
            case 'click':
                this._setPositionWithAnimate(positionInPercent);
                break;
            default:
                this._updatePosition(positionInPercent);
        }
    };


    /**
     * Set position with animate
     * @param newPositionInPercent
     * @returns {boolean}
     * @private
     */
    ImageComparison.prototype._setPositionWithAnimate = function (newPositionInPercent) {
        var comparison = this;
        var currentPositionInPercent = parseFloat(comparison._items[0].style.width);
        clearInterval(comparison._animateInterval);

        if (newPositionInPercent == currentPositionInPercent) {
            return false;
        }
        else if (currentPositionInPercent > newPositionInPercent) {
            decrementPosition();
        }
        else {
            incrementPosition();
        }


        // Support animate functions
        function incrementPosition() {
            comparison._animateInterval = setInterval(function () {
                currentPositionInPercent++;
                comparison._updatePosition(currentPositionInPercent);
                if (currentPositionInPercent >= newPositionInPercent) {
                    setFinalPositionAndClearInterval();
                }
            }, 10);
        }

        function decrementPosition() {
            comparison._animateInterval = setInterval(function () {
                currentPositionInPercent--;
                comparison._updatePosition(currentPositionInPercent);
                if (currentPositionInPercent <= newPositionInPercent) {
                    setFinalPositionAndClearInterval();
                }
            }, 10);
        }

        function setFinalPositionAndClearInterval() {
            comparison._updatePosition(newPositionInPercent);
            clearInterval(comparison._animateInterval);
        }


    };


    /**
     * Set position item[0]
     * @param percent
     * @private
     */
    ImageComparison.prototype._updatePosition = function (percent) {
        this._items[0].style.width = percent + '%';
    };


    /**
     * Set the width of image that has a position absolute
     * @private
     */
    ImageComparison.prototype._setImageSize = function () {
        this.images[0].style.width = this.container.offsetWidth + 'px';
    };


    /**
     * Utils Methods
     * @type {{extend: Function, getConstructor: Function}}
     */
    var utils = {

        /**
         * Native extend object
         * @param target
         * @param objects
         * @param options
         * @returns {*}
         */
        extend: function (target, objects, options) {

            for (var object in objects) {
                if (objects.hasOwnProperty(object)) {
                    recursiveMerge(target, objects[object]);
                }
            }

            function recursiveMerge(target, object) {
                for (var property in object) {
                    if (object.hasOwnProperty(property)) {
                        var current = object[property];
                        if (utils.getConstructor(current) === 'Object') {
                            if (!target[property]) {
                                target[property] = {};
                            }
                            recursiveMerge(target[property], current);
                        }
                        else {
                            // clearEmpty
                            if (options.clearEmpty) {
                                if (current == null) {
                                    continue;
                                }
                            }
                            target[property] = current;
                        }
                    }
                }
            }

            return target;
        },


        /**
         * Set Multi addEventListener
         * @param element
         * @param events
         * @param func
         */
        setMultiEvents: function (element, events, func) {
            for (var i = 0; i < events.length; i++) {
                element.addEventListener(events[i], func);
            }
        },


        /**
         * Get object constructor
         * @param object
         * @returns {string}
         */
        getConstructor: function (object) {
            return Object.prototype.toString.call(object).slice(8, -1);
        }
    };


    if (typeof define === 'function' && define.amd) {
        define('ImageComparison', [], function () {
            return ImageComparison;
        });
    }
    else {
        root.ImageComparison = ImageComparison;
    }


}(this));
