/**
 * Widget text in English, Hindi and Arabic. The Hindi and Arabic wording has not been reviewed by a native
 * speaker yet: have one read it before it goes in front of customers.
 */

export type Locale = 'en' | 'hi' | 'ar';

export const LOCALES: readonly Locale[] = ['en', 'hi', 'ar'];

export interface Strings {
  buttonLabel: string;
  title: string;
  consent: string;
  tips: string;
  choosePhoto: string;
  changePhoto: string;
  checkingPhoto: string;
  photoReady: string;
  tryIt: string;
  working: string;
  sideBackLoading: string;
  front: string;
  side: string;
  back: string;
  tryAnother: string;
  addToCart: string;
  saveImage: string;
  saveHint: string;
  close: string;
  disclaimer: string;
  errors: {
    NO_PERSON: string;
    MULTIPLE_PEOPLE: string;
    PERSON_TOO_SMALL: string;
    /** Contains {seconds}. */
    RATE_LIMITED: string;
    UNAVAILABLE: string;
    INVALID_PHOTO: string;
    INVALID_PRODUCT_IMAGE: string;
    CONSENT_REQUIRED: string;
    PAYLOAD_TOO_LARGE: string;
    NETWORK: string;
    TIMEOUT: string;
    JOB_FAILED: string;
    GENERIC: string;
  };
}

export const STRINGS: Record<Locale, Strings> = {
  en: {
    buttonLabel: 'Try it on',
    title: 'Try it on',
    consent: 'I agree to my photo being used for this try-on only. It is deleted after the result is ready.',
    tips: 'Use a photo of yourself standing straight, facing the camera, with your whole body in view.',
    choosePhoto: 'Choose a photo',
    changePhoto: 'Choose another photo',
    checkingPhoto: 'Checking your photo…',
    photoReady: 'Your photo looks good',
    tryIt: 'See it on me',
    working: 'Creating your look… this takes about half a minute.',
    sideBackLoading: 'Your front view is ready. Loading the side and back views…',
    front: 'Front',
    side: 'Side',
    back: 'Back',
    tryAnother: 'Try another photo',
    addToCart: 'Add to cart',
    saveImage: 'Save or share',
    saveHint: 'Press and hold the picture (or right-click it) and choose Save image.',
    close: 'Close',
    disclaimer: 'A visual preview, not a size guarantee. The back view may be an estimate.',
    errors: {
      NO_PERSON: "We couldn't find a person in your photo. Choose a clear photo of yourself, standing and facing the camera.",
      MULTIPLE_PEOPLE: 'There is more than one person in this photo. Choose a photo with only you in it.',
      PERSON_TOO_SMALL: 'You look too small or cut off in this photo. Choose one that shows at least your shoulders and torso.',
      RATE_LIMITED: 'Too many attempts. Please try again in {seconds} seconds.',
      UNAVAILABLE: 'Try-on is not available right now. Please try again later.',
      INVALID_PHOTO: "We couldn't read that photo. Please choose a JPEG, PNG or WebP image.",
      INVALID_PRODUCT_IMAGE: "This product can't be tried on.",
      CONSENT_REQUIRED: 'Please agree to continue.',
      PAYLOAD_TOO_LARGE: 'That photo is too large. Please choose a smaller one.',
      NETWORK: 'The connection was lost. Check your internet and try again.',
      TIMEOUT: 'This is taking longer than expected. Please try again.',
      JOB_FAILED: "We couldn't create your try-on this time. Please try again.",
      GENERIC: 'Something went wrong. Please try again.',
    },
  },
  hi: {
    buttonLabel: 'खुद पर आज़माएँ',
    title: 'खुद पर आज़माएँ',
    consent: 'मैं सहमत हूँ कि मेरी फ़ोटो सिर्फ़ इस ट्राई-ऑन के लिए इस्तेमाल होगी और नतीजा तैयार होने के बाद हटा दी जाएगी।',
    tips: 'अपनी ऐसी फ़ोटो चुनें जिसमें आप सीधे खड़े हों, कैमरे की तरफ़ देख रहे हों और पूरा शरीर दिख रहा हो।',
    choosePhoto: 'फ़ोटो चुनें',
    changePhoto: 'दूसरी फ़ोटो चुनें',
    checkingPhoto: 'आपकी फ़ोटो जाँची जा रही है…',
    photoReady: 'फ़ोटो ठीक है',
    tryIt: 'मुझ पर दिखाएँ',
    working: 'आपका लुक बन रहा है… इसमें करीब आधा मिनट लगता है।',
    sideBackLoading: 'सामने का व्यू तैयार है। साइड और पीछे के व्यू आ रहे हैं…',
    front: 'सामने',
    side: 'साइड',
    back: 'पीछे',
    tryAnother: 'दूसरी फ़ोटो से आज़माएँ',
    addToCart: 'कार्ट में जोड़ें',
    saveImage: 'सेव या शेयर करें',
    saveHint: 'तस्वीर को दबाकर रखें (या राइट-क्लिक करें) और इमेज सेव करना चुनें।',
    close: 'बंद करें',
    disclaimer: 'यह सिर्फ़ एक विज़ुअल अंदाज़ा है, साइज़ की गारंटी नहीं। पीछे का व्यू अनुमान पर बना हो सकता है।',
    errors: {
      NO_PERSON: 'आपकी फ़ोटो में कोई व्यक्ति नहीं दिखा। कृपया अपनी साफ़ फ़ोटो चुनें, जिसमें आप सीधे खड़े हों।',
      MULTIPLE_PEOPLE: 'फ़ोटो में एक से ज़्यादा लोग हैं। कृपया सिर्फ़ आपकी फ़ोटो चुनें।',
      PERSON_TOO_SMALL: 'आप फ़ोटो में बहुत छोटे दिख रहे हैं या कट गए हैं। कम से कम कंधे और धड़ दिखने वाली फ़ोटो चुनें।',
      RATE_LIMITED: 'बहुत ज़्यादा कोशिशें हो गईं। कृपया {seconds} सेकंड बाद फिर कोशिश करें।',
      UNAVAILABLE: 'ट्राई-ऑन अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद कोशिश करें।',
      INVALID_PHOTO: 'यह फ़ोटो पढ़ी नहीं जा सकी। कृपया JPEG, PNG या WebP फ़ोटो चुनें।',
      INVALID_PRODUCT_IMAGE: 'इस प्रोडक्ट पर ट्राई-ऑन नहीं हो सकता।',
      CONSENT_REQUIRED: 'आगे बढ़ने के लिए सहमति देना ज़रूरी है।',
      PAYLOAD_TOO_LARGE: 'फ़ोटो बहुत बड़ी है। कृपया छोटी फ़ोटो चुनें।',
      NETWORK: 'कनेक्शन टूट गया। कृपया इंटरनेट जाँचकर फिर कोशिश करें।',
      TIMEOUT: 'इसमें ज़्यादा समय लग रहा है। कृपया फिर कोशिश करें।',
      JOB_FAILED: 'इस बार ट्राई-ऑन नहीं बन सका। कृपया फिर कोशिश करें।',
      GENERIC: 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।',
    },
  },
  ar: {
    buttonLabel: 'جرّبها عليك',
    title: 'جرّبها عليك',
    consent: 'أوافق على استخدام صورتي لهذه التجربة فقط، وسيتم حذفها بعد ظهور النتيجة.',
    tips: 'اختر صورة لك وأنت واقف وتنظر إلى الكاميرا ويظهر جسمك كاملاً.',
    choosePhoto: 'اختر صورة',
    changePhoto: 'اختر صورة أخرى',
    checkingPhoto: 'جارٍ فحص صورتك…',
    photoReady: 'الصورة مناسبة',
    tryIt: 'أرني عليّ',
    working: 'جارٍ إنشاء إطلالتك… يستغرق ذلك نحو نصف دقيقة.',
    sideBackLoading: 'العرض الأمامي جاهز. جارٍ تحميل العرض الجانبي والخلفي…',
    front: 'أمامي',
    side: 'جانبي',
    back: 'خلفي',
    tryAnother: 'جرّب بصورة أخرى',
    addToCart: 'أضف إلى السلة',
    saveImage: 'حفظ أو مشاركة',
    saveHint: 'اضغط مطولاً على الصورة (أو انقر بزر الماوس الأيمن) واختر حفظ الصورة.',
    close: 'إغلاق',
    disclaimer: 'هذه معاينة بصرية فقط وليست ضماناً للمقاس. قد يكون العرض الخلفي تقديرياً.',
    errors: {
      NO_PERSON: 'لم نجد شخصاً في صورتك. اختر صورة واضحة لك وأنت واقف.',
      MULTIPLE_PEOPLE: 'في الصورة أكثر من شخص. اختر صورة لك وحدك.',
      PERSON_TOO_SMALL: 'تبدو صغيراً في الصورة أو مقصوصاً. اختر صورة تظهر الكتفين والجذع على الأقل.',
      RATE_LIMITED: 'محاولات كثيرة. حاول مرة أخرى بعد {seconds} ثانية.',
      UNAVAILABLE: 'التجربة غير متاحة حالياً. حاول لاحقاً.',
      INVALID_PHOTO: 'تعذّرت قراءة الصورة. اختر صورة بصيغة JPEG أو PNG أو WebP.',
      INVALID_PRODUCT_IMAGE: 'لا يمكن تجربة هذا المنتج.',
      CONSENT_REQUIRED: 'الموافقة مطلوبة للمتابعة.',
      PAYLOAD_TOO_LARGE: 'الصورة كبيرة جداً. اختر صورة أصغر.',
      NETWORK: 'انقطع الاتصال. تحقق من الإنترنت وحاول مجدداً.',
      TIMEOUT: 'يستغرق الأمر وقتاً أطول من المتوقع. حاول مجدداً.',
      JOB_FAILED: 'تعذّر إنشاء التجربة هذه المرة. حاول مجدداً.',
      GENERIC: 'حدث خطأ ما. حاول مجدداً.',
    },
  },
};

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

const primaryLanguage = (value: string | undefined): string => (value ?? '').trim().toLowerCase().split(/[-_]/)[0];

/** The merchant's explicit choice wins, then the page language, else English. */
export function resolveLocale(requested: string | undefined, pageLang: string | undefined): Locale {
  const explicit = primaryLanguage(requested);
  if (isLocale(explicit)) return explicit;
  const fromPage = primaryLanguage(pageLang);
  return isLocale(fromPage) ? fromPage : 'en';
}

export const directionOf = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');

const PHOTO_PROBLEMS = ['NO_PERSON', 'MULTIPLE_PEOPLE', 'PERSON_TOO_SMALL'] as const;
// What the shopper hears for problems that are the merchant's: never configuration or billing details.
const UNAVAILABLE_CODES = new Set([
  'ORIGIN_NOT_ALLOWED',
  'UNKNOWN_SHOP',
  'SHOP_INACTIVE',
  'DAILY_CAP_REACHED',
  'INSUFFICIENT_CREDITS',
]);
const DIRECT_CODES = [
  'INVALID_PHOTO',
  'INVALID_PRODUCT_IMAGE',
  'CONSENT_REQUIRED',
  'PAYLOAD_TOO_LARGE',
  'NETWORK',
  'TIMEOUT',
  'JOB_FAILED',
] as const;

export interface ErrorInfo {
  code: string;
  problem?: string;
  retryAfterMs?: number;
}

export function errorText(strings: Strings, { code, problem, retryAfterMs }: ErrorInfo): string {
  const { errors } = strings;

  if (code === 'PHOTO_PROBLEM') {
    const known = PHOTO_PROBLEMS.find(item => item === problem);
    return known ? errors[known] : errors.INVALID_PHOTO;
  }
  if (code === 'RATE_LIMITED') {
    const seconds = Math.max(1, Math.ceil((retryAfterMs ?? 0) / 1000));
    return errors.RATE_LIMITED.replace('{seconds}', String(seconds));
  }
  if (UNAVAILABLE_CODES.has(code)) return errors.UNAVAILABLE;

  const direct = DIRECT_CODES.find(item => item === code);
  return direct ? errors[direct] : errors.GENERIC;
}
