import safeShopping from "@/assets/blog-safe-shopping.jpg";
import chooseProduct from "@/assets/blog-choose-product.jpg";
import fashionTrends from "@/assets/blog-fashion-trends.jpg";
import sellersGuide from "@/assets/blog-sellers-guide.jpg";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  image: string;
  readTime: string;
  category: string;
  tags: string[];
  content: { heading?: string; paragraph: string }[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "safe-online-shopping",
    title: "نصائح للتسوق الآمن عبر الإنترنت",
    description: "دليل شامل لحماية نفسك أثناء التسوق الإلكتروني",
    date: "2024-01-15",
    author: "فريق SiloShop",
    image: safeShopping,
    readTime: "5 دقائق",
    category: "نصائح للمشترين",
    tags: ["أمان", "تسوق", "حماية", "كلمات مرور"],
    content: [
      {
        paragraph:
          "أصبح التسوق عبر الإنترنت جزءاً أساسياً من حياتنا اليومية، ومع تزايد عمليات الشراء الإلكتروني تتزايد أيضاً المخاطر المرتبطة بها. في هذا الدليل نشاركك أهم النصائح لضمان تجربة تسوق آمنة وممتعة.",
      },
      {
        heading: "1. تسوّق من متاجر موثوقة",
        paragraph:
          "احرص دائماً على الشراء من متاجر معروفة ولها سمعة جيدة مثل SiloShop. تحقق من تقييمات المتجر وآراء العملاء السابقين قبل إتمام عملية الشراء.",
      },
      {
        heading: "2. تحقق من رابط الموقع",
        paragraph:
          "تأكد أن عنوان الموقع يبدأ بـ https:// ويحتوي على أيقونة القفل في شريط العنوان، فهذا يدل على أن اتصالك مشفّر وآمن.",
      },
      {
        heading: "3. استخدم كلمات مرور قوية",
        paragraph:
          "اختر كلمات مرور طويلة ومعقدة، ولا تستخدم نفس كلمة المرور في أكثر من موقع. فعّل التحقق بخطوتين كلما أمكن ذلك لحماية إضافية.",
      },
      {
        heading: "4. راجع الطلب قبل تأكيده",
        paragraph:
          "قبل الضغط على زر الدفع، راجع تفاصيل الطلب: المنتجات، الكمية، عنوان التوصيل، وطريقة الدفع. هذا يجنبك الأخطاء المكلفة.",
      },
      {
        heading: "5. احتفظ بسجلات الشراء",
        paragraph:
          "احفظ رسائل تأكيد الطلب وأرقام التتبع حتى استلام المنتج، فهي مرجعك الأساسي في حال حدوث أي مشكلة.",
      },
    ],
  },
  {
    slug: "how-to-choose-product",
    title: "كيف تختار المنتج المناسب؟",
    description: "خطوات عملية لاتخاذ قرار شراء صحيح",
    date: "2024-01-10",
    author: "فريق SiloShop",
    image: chooseProduct,
    readTime: "4 دقائق",
    category: "نصائح للمشترين",
    tags: ["مقارنة", "تسوق", "تقييمات"],
    content: [
      {
        paragraph:
          "كثرة الخيارات قد تجعل اتخاذ قرار الشراء أمراً صعباً. إليك خطوات بسيطة تساعدك على اختيار المنتج الذي يناسب احتياجاتك وميزانيتك.",
      },
      {
        heading: "حدّد احتياجك أولاً",
        paragraph:
          "قبل البحث، اسأل نفسك: لماذا أحتاج هذا المنتج؟ وما المواصفات الأساسية التي يجب أن يوفرها؟ وضوح الهدف يختصر عليك ساعات من البحث.",
      },
      {
        heading: "قارن بين المنتجات",
        paragraph:
          "استخدم ميزة المقارنة في SiloShop لمقارنة حتى 4 منتجات جنباً إلى جنب من حيث السعر والمواصفات والتقييمات.",
      },
      {
        heading: "اقرأ تقييمات المستخدمين",
        paragraph:
          "آراء المشترين السابقين كنز حقيقي. ركّز على التقييمات التفصيلية التي تذكر إيجابيات وسلبيات المنتج بصراحة.",
      },
      {
        heading: "تحقق من سياسة الإرجاع",
        paragraph:
          "تأكد دائماً من وجود سياسة إرجاع واضحة قبل الشراء، حتى تكون مطمئناً في حال لم يطابق المنتج توقعاتك.",
      },
    ],
  },
  {
    slug: "fashion-trends-this-season",
    title: "أحدث صيحات الموضة لهذا الموسم",
    description: "تعرف على أبرز اتجاهات الموضة والأناقة",
    date: "2024-01-05",
    author: "فريق SiloShop",
    image: fashionTrends,
    readTime: "6 دقائق",
    category: "الموضة والأناقة",
    tags: ["موضة", "ألوان", "إكسسوارات", "أحذية"],
    content: [
      {
        paragraph:
          "الموضة لغة تتجدد كل موسم، وفي هذا المقال نستعرض أبرز الصيحات التي تتصدر المشهد هذا العام لتساعدك على بناء إطلالات عصرية وأنيقة.",
      },
      {
        heading: "الألوان الترابية تعود بقوة",
        paragraph:
          "البيج، الكاراميل، والبني الفاتح هي ألوان الموسم بلا منازع. ادمجها مع الأبيض أو الأسود للحصول على إطلالة كلاسيكية لا تخطئ.",
      },
      {
        heading: "القصّات الواسعة",
        paragraph:
          "البناطيل الواسعة والقمصان الفضفاضة تمنحك الراحة والأناقة معاً، وتعتبر الخيار المثالي للإطلالات اليومية.",
      },
      {
        heading: "الإكسسوارات الذهبية",
        paragraph:
          "السلاسل العريضة والأقراط الذهبية تضيف لمسة فاخرة لأي إطلالة بسيطة. لا تتردد في المزج بينها للحصول على مظهر متميز.",
      },
      {
        heading: "الأحذية الرياضية الأنيقة",
        paragraph:
          "السنيكرز البيضاء أصبحت قطعة أساسية في خزانة كل شخص، وتناسب الإطلالات الكاجوال والرسمية على حدٍ سواء.",
      },
    ],
  },
  {
    slug: "new-sellers-guide",
    title: "دليل البائعين الجدد",
    description: "كل ما تحتاج معرفته للبدء في البيع على منصتنا",
    date: "2024-01-01",
    author: "فريق SiloShop",
    image: sellersGuide,
    readTime: "7 دقائق",
    category: "دليل البائعين",
    tags: ["بيع", "بائعين", "متجر", "تسويق"],
    content: [
      {
        paragraph:
          "بدء رحلتك كبائع على SiloShop خطوة ذكية لتنمية مشروعك والوصول لآلاف العملاء في سوريا. إليك خطوات عملية لانطلاقة ناجحة.",
      },
      {
        heading: "1. أنشئ حساب بائع",
        paragraph:
          "سجّل حسابك واختر دور 'بائع'، ثم أكمل بيانات متجرك من اسم، شعار، ووصف يعبّر عن هويتك.",
      },
      {
        heading: "2. أضف منتجاتك باحترافية",
        paragraph:
          "استخدم صوراً عالية الجودة بإضاءة جيدة، واكتب وصفاً واضحاً يذكر المواصفات والمميزات والمقاسات المتوفرة.",
      },
      {
        heading: "3. حدّد أسعاراً تنافسية",
        paragraph:
          "ادرس أسعار المنافسين، وفكّر في تقديم خصومات للكميات الكبيرة أو كوبونات ترويجية لجذب عملاء جدد.",
      },
      {
        heading: "4. تواصل بسرعة مع العملاء",
        paragraph:
          "الرد السريع على الاستفسارات يبني الثقة ويزيد فرص إتمام البيع. استخدم نظام المحادثات المدمج في SiloShop.",
      },
      {
        heading: "5. اهتم بالتقييمات",
        paragraph:
          "بعد كل طلب، شجّع العميل على ترك تقييم. التقييمات الإيجابية هي أقوى أداة تسويقية لمتجرك على المدى الطويل.",
      },
    ],
  },
];

export const getPostBySlug = (slug: string) =>
  blogPosts.find((p) => p.slug === slug);

export const getAllCategories = (): string[] =>
  Array.from(new Set(blogPosts.map((p) => p.category)));

export const getAllTags = (): string[] =>
  Array.from(new Set(blogPosts.flatMap((p) => p.tags)));

export const getRelatedPosts = (post: BlogPost, limit = 3): BlogPost[] => {
  return blogPosts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const sameCategory = p.category === post.category ? 3 : 0;
      const sharedTags = p.tags.filter((t) => post.tags.includes(t)).length;
      return { post: p, score: sameCategory + sharedTags };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post);
};

export const slugifyHeading = (heading: string): string =>
  heading
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();