class HotSport extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.addEventListener('click', (e) => {
            e.preventDefault();
            //console.log('Clicked');
            this.openPopup(e);
        });
    }
    openPopup(e) {
        // console.log('Clicked inner', this);
        const handle = this.getAttribute('data-handle');
        // console.log('handle', handle);
        fetch(`${handle}?section_id=hotspot-popup-product`)
            .then(response => response.text())
            .then(product => {
                const html = new DOMParser().parseFromString(product, 'text/html');
                const targetElement = document.querySelector('.hotspot-content-html');
                const newContent = html.querySelector('.hotspot-content-html');
                // console.log('targetElement:', targetElement, 'newContent :', newContent);
                if (targetElement && newContent) {
                    targetElement.replaceWith(newContent);
                    document.querySelector('#hotspot_popup')?.classList.add('active');
                }
            })
            .catch(error => {
                console.error('Error fetching product data:', error);
            });

    }
}




function closePopup() {
    const closeIcon = document.querySelector('.close-button');
    const outerClick = document.querySelector('#hotspot_popup');
    if (!closeIcon || !outerClick) return;
    closeIcon.addEventListener('click', (e) => {
        e.target.closest('#hotspot_popup')?.classList.remove('active');
    });

    outerClick.addEventListener('click', (e) => {
        e.target?.classList.remove('active');
    });
}
document.addEventListener('DOMContentLoaded', closePopup);


class variantPickerCustom extends HTMLElement {
    connectedCallback() {
        this?.addEventListener('change', this.onVariantChange);
    }
    onVariantChange() {

        let finalOptionValues = this.getOptionValues();
        if (!finalOptionValues.length || (finalOptionValues.indexOf('null') !== -1)) return;
        // console.log('finalOptionValues', finalOptionValues);

        const sectionId = (this.id || '').replace('shopify-section-', '');
        const url = `${this.dataset.handle}?option_values=${finalOptionValues.join(',')}&section_id=${sectionId}`;
        //console.log('url ===', url);
        this.updatePopupContent(url);
    }

    getOptionValues() {
        this.optionValues = [];
        this.querySelectorAll('select').forEach(select => {
            const val =
                select.options[select.selectedIndex]?.value ?? '';
            if (val) this.optionValues.push(val);
        });

        this.querySelectorAll('input:checked').forEach(input => {
            const val = input.value ?? '';
            if (val) this.optionValues.push(val);
        });
        return this.optionValues;
    }

    async updatePopupContent(url) {
        try {
            const res = await fetch(url);
            const htmlText = await res.text();
            const html = new DOMParser().parseFromString(htmlText, 'text/html');
            const parent = this.closest('.hotspot-content-html');
            const selectors = ['.price', 'variant-picker-custom', 'product-form-custom'];
            for (let selector of selectors) {
                const targetElement = parent.querySelector(selector);
                const sourceElement = html.querySelector(selector);
                if (targetElement && sourceElement) {
                    targetElement.replaceWith(sourceElement);
                }
            }
        } catch (err) {
            console.error('Error:', err);
        }
    }
}
if (!customElements.get('variant-picker-custom')) {
    customElements.define('variant-picker-custom', variantPickerCustom);
}

customElements.define('hotspot-icon', HotSport);


if (!customElements.get('product-form-custom')) {
    customElements.define(
        'product-form-custom',
        class ProductForm extends HTMLElement {
            constructor() {
                super();

                this.form = this.querySelector('form');
                this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
                this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
                this.submitButton = this.querySelector('[type="submit"]');
                this.submitButtonText = this.submitButton.querySelector('span');
                this.parent = this.closest('.hotspot-content-html');
                this.variantPickerCustom = this.parent.querySelector('variant-picker-custom');
                if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

                this.hideErrors = this.dataset.hideErrors === 'true';
            }

            onSubmitHandler(evt) {
                evt.preventDefault();
                if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

                this.handleErrorMessage();

                if (this.variantPickerCustom) {
                    let tempOptionValues = this.variantPickerCustom.getOptionValues();
                    if (tempOptionValues.indexOf('null') !== -1) {
                        this.handleErrorMessage('Select your size');
                        return;
                    }
                }
                this.submitButton.setAttribute('aria-disabled', true);
                this.submitButton.classList.add('loading');
                this.querySelector('.loading__spinner')?.classList.remove('hidden');

                const config = fetchConfig('javascript');
                config.headers['X-Requested-With'] = 'XMLHttpRequest';
                delete config.headers['Content-Type'];

                const formData = new FormData(this.form);
                if (this.cart) {
                    formData.append(
                        'sections',
                        this.cart.getSectionsToRender().map((section) => section.id)
                    );
                    formData.append('sections_url', window.location.pathname);
                    this.cart.setActiveElement(document.activeElement);
                }
                config.body = formData;

                fetch(`${routes.cart_add_url}`, config)
                    .then((response) => response.json())
                    .then((response) => {
                        if (response.status) {
                            publish(PUB_SUB_EVENTS.cartError, {
                                source: 'product-form',
                                productVariantId: formData.get('id'),
                                errors: response.errors || response.description,
                                message: response.message,
                            });
                            this.handleErrorMessage(response.description);

                            const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
                            if (!soldOutMessage) return;
                            this.submitButton.setAttribute('aria-disabled', true);
                            this.submitButtonText.classList.add('hidden');
                            soldOutMessage.classList.remove('hidden');
                            this.error = true;
                            return;
                        } else if (!this.cart) {
                            window.location = window.routes.cart_url;
                            return;
                        }

                        if (!this.error) {
                            let popup = this.closest('#hotspot_popup');
                            popup?.classList.remove('active');
                            publish(PUB_SUB_EVENTS.cartUpdate, {
                                source: 'product-form',
                                productVariantId: formData.get('id'),
                                cartData: response,
                            });
                        }
                        this.error = false;
                        this.cart.renderContents(response);
                    })
                    .catch((e) => {
                        console.error(e);
                    })
                    .finally(() => {
                        this.submitButton.classList.remove('loading');
                        if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
                        if (!this.error) this.submitButton.removeAttribute('aria-disabled');
                        this.querySelector('.loading__spinner')?.classList.add('hidden');
                    });
            }
            handleErrorMessage(errorMessage = false) {
                if (this.hideErrors) return;

                this.errorMessageWrapper =
                    this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
                if (!this.errorMessageWrapper) return;
                this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

                this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

                if (errorMessage) {
                    this.errorMessage.textContent = errorMessage;
                }
            }

            toggleSubmitButton(disable = true, text) {
                if (disable) {
                    this.submitButton.setAttribute('disabled', 'disabled');
                    if (text) this.submitButtonText.textContent = text;
                } else {
                    this.submitButton.removeAttribute('disabled');
                    this.submitButtonText.textContent = window.variantStrings.addToCart;
                }
            }

        }
    );
}

