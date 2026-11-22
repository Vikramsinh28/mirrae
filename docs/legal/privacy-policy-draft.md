<!--
DRAFT (2026-11-22). Not legal advice and not reviewed by a lawyer. Written from what the code does today.
Anything in [square brackets] is a blank to fill or a decision to make. See README.md in this folder.
-->

# Privacy Policy

**Mirrae** · Last updated: [date]

Mirrae ("we", "us") is operated by [legal entity name], [registered address]. It lets online stores add a "Try it on" button to their product pages, so a shopper can see a clothing item on a photo of themselves. This policy explains what we collect, why, who else sees it, and how long we keep it. It covers two groups of people: **shoppers** who use the button on a store, and **merchants** who run those stores.

Questions or requests: [privacy contact email].

## 1. Shoppers

### What happens when you try something on

1. You choose a photo of yourself and tick a box agreeing that we may use it for this try-on only.
2. We re-save the photo as a new image (which drops embedded details such as location and camera data) and ask an AI model to check that it shows one person and that the product is a piece of clothing.
3. We send your photo and the product's picture to an AI image model, which makes the result. Extra side and back views are made from the front result, not from your photo.
4. We show you the result. **Your original photo is deleted as soon as the front view is finished**, or as soon as the attempt fails. It is not kept for a second try-on.

### What we receive and keep

| What | Why | How long |
|---|---|---|
| The photo you upload | To make your try-on | Deleted right after the front view; at the very latest removed by an automatic storage rule within about two days |
| The result images (front, side, back) | To show them to you | Removed automatically from storage within about two days. Download or share a result if you want to keep it |
| A random session number (not your name, email or account) | To keep one try-on together and apply limits | About two hours |
| Counts of what happened in a session: opened the button, saw a result, added to cart, shared | To show the store how the button performs, with no photo and no identity | [retention, e.g. kept with the store's usage records] |
| Your internet (IP) address | Held briefly in memory to stop bots and abuse; ordinary server logs may also contain it | [log retention, depends on hosting] |
| A record of the try-on (time, status, which store and product image, that you gave consent). It contains no photo | Billing the store, support, fixing errors | [retention; the code does not delete these records today] |

We do **not** ask for your name or email, we do **not** set cookies or use browser storage in the button, and we do **not** use your photo for advertising, to train AI models, or to identify who you are. We do not sell personal information.

"Add to cart" simply presses the store's own button on the page; the store handles what happens next under its own privacy policy.

### Who provides the try-on

The store you are on offers the try-on and pays for it. For your photo we act as the store's service provider and follow the purpose above. The store's own privacy policy covers everything else it does with your data.

### Things to know about the results

The images are made by AI and are an approximation, not a photograph. Side and back views are invented when the product picture shows only the front. Results do not guarantee how an item will fit or look in person. Please only upload photos of yourself, or of someone who has agreed.

## 2. Merchants

### What we collect

- **Account details:** name, email address and, if you sign in with Google, your Google profile name and picture. We store a password only in hashed form where you chose one.
- **Shopify stores:** your store name and address (the `.myshopify.com` domain, and a primary domain if you have one), and the contact email Shopify gives us for the store. We do not ask Shopify for access to your customers, orders or products, and we do not store a Shopify access token. Billing for credits runs through Shopify; we never see your card.
- **Your settings and usage:** allowed websites, image hosts, daily limits, credit balance and credit history, the number of try-ons and how they went, and the conversion counts described above.
- **Payments (web accounts):** handled by Stripe; we keep the customer reference and the credit history, not card numbers.
- **Messages you send us** and what is needed to answer them.
- **Technical data:** server logs, error reports, IP address, browser type.

### Why we use it

To provide and bill for the service, keep it secure and within limits, show you usage, answer support requests, meet legal duties, and improve reliability. [If you add marketing email, say so here.]

### When you uninstall or close your account

Uninstalling the Shopify app switches your shop off at once. Shopify then asks us to erase the store's data 48 hours later; when that request arrives we delete the shop and its counts and close the account linked to it. We keep the credit-purchase records we need for accounting and tax [for N years].

## 3. Who we share data with

We use these providers to run the service. They may process data only to provide their service to us:

- **Google Cloud (Vertex AI and Gemini):** receives photos and product images to check them and to make the results. Google states in its [data governance documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance) that it does not use customer data to train or fine-tune its models without the customer's permission, and that prompts may be logged for abuse monitoring under its cloud terms. The try-on model runs in us-central1; the image-editing model uses Google's "global" location, where requests can be served from any region. [Lawyer: confirm this wording against the terms that apply to our account.]
- **Amazon Web Services (S3, Mumbai region):** short-lived storage of photos and result images.
- **Stripe:** payments for web accounts.
- **Shopify:** installation, sign-in inside the Shopify admin, and billing for Shopify stores.
- **[Hosting provider]** and **[email provider, if any]**.

We may also disclose information when the law requires it, or to protect the service and its users. We do not sell or rent personal information.

## 4. Where data is processed

Storage is in India (AWS Mumbai). Photos are processed by Google in the United States and possibly other locations, and our servers are at [hosting location]. So your information may leave the country you live in. [Add transfer safeguards your lawyer recommends.]

## 5. Security

Photos and results are kept in a private storage bucket that is not open to the public and are shown through short-lived links. Connections use HTTPS. Access to our systems is limited to what each person needs. No system is perfectly secure, so please report concerns to [security contact].

## 6. Your choices and rights

Depending on where you live (for example the EU, UK or India) you may have the right to ask what we hold about you, to correct or delete it, to object to or restrict its use, to withdraw consent, and to complain to your data protection authority. Because shoppers are anonymous and their photos are deleted within minutes, we usually hold nothing that can be tied to a particular person; if you think we do, write to [privacy contact email] with the store and the approximate time. Merchants can change their settings in the dashboard and can ask us to delete their account.

[Legal bases if you serve people in the EU/UK: consent for the shopper photo; contract for merchants; legitimate interests for security and analytics.]

## 7. Children

The service is not meant for people under [age, e.g. 16/18], and we do not knowingly collect their photos or data. If you believe a child has used it, tell us and we will delete what we can.

## 8. Changes

If we change this policy in a way that matters we will update the date above and, for merchants, tell you in the dashboard or by email.

## 9. Contact

[Legal entity name] · [address] · [privacy contact email]
