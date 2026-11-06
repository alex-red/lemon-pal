// Minimal types for the parts of the PayPal JavaScript SDK v6 that LemonPal uses.
// https://developer.paypal.com/sdk/js/reference

export type PayPalOneTimePaymentSession = {
  start(
    options: { presentationMode: "auto" | "popup" | "modal" | "redirect" },
    orderPromise: Promise<{ orderId: string }>,
  ): Promise<void | { redirectURL?: string }>;
  hasReturned(): boolean;
  resume(): Promise<void>;
};

export type PayPalSdkInstance = {
  findEligibleMethods(options: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(callbacks: {
    onApprove(data: { orderId: string; payerId?: string }): Promise<void> | void;
    onCancel?(data: { orderId?: string }): void;
    onError?(error: { code?: string; message?: string }): void;
  }): PayPalOneTimePaymentSession;
};

declare global {
  interface Window {
    paypal?: {
      createInstance(options: {
        clientId: string;
        components: string[];
        pageType?: "checkout" | "product-details" | "cart" | "mini-cart" | "home";
      }): Promise<PayPalSdkInstance>;
    };
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: "pay" | "checkout" | "buynow" | "subscribe";
      };
    }
  }
}
