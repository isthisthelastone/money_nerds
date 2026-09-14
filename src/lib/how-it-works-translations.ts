import type { TranslatedGuideLocale } from "@/lib/guide-languages";

type Step = { title: string; text: string };

type GuideTranslation = {
  label: string;
  title: string;
  description: string;
  introduction: string;
  breadcrumbLabel: string;
  createTitle: string;
  createSteps: readonly Step[];
  supportTitle: string;
  supportSteps: readonly Step[];
  fees: string;
  networksTitle: string;
  networksIntroduction: string;
  networks: readonly (readonly [string, string])[];
  sbpTitle: string;
  sbpParagraphs: readonly string[];
  links: {
    composer: string;
    build: string;
    mutualAid: string;
    transparency: string;
    settings: string;
    safety: string;
    related: string;
    faq: string;
    community: string;
  };
  callout: { kicker: string; title: string; text: string; action: string };
};

// Keep these complete translations aligned with /how-it-works whenever the
// product's supported routes or funding/verification behavior changes.
export const HOW_IT_WORKS_TRANSLATIONS = {
  ru: {
    label: "Как это работает",
    title: "Ваша первая просьба. Ваш первый шаг навстречу.",
    description: "Как создать пост в Money Nerds, указать адреса для получения средств и поддержать человека напрямую в нужной криптосети.",
    introduction: "Money Nerds — открытая доска для идей, мемов, творчества и реальных нужд. Пост начинает разговор, а поддержка поступает напрямую по реквизитам, которые указал его автор.",
    breadcrumbLabel: "Навигационная цепочка",
    createTitle: "Расскажите о своей просьбе понятно.",
    createSteps: [
      { title: "Войдите и выберите категорию", text: "Используйте один из способов, доступных на экране входа. Откройте форму публикации на общей доске или начните в категории, например Build («Проекты») или Mutual Aid («Взаимопомощь»). Категория страницы будет выбрана заранее; перед публикацией её можно изменить." },
      { title: "Добавьте контекст", text: "Выберите публичный никнейм и объясните, что хотите сделать, на что нужна поддержка и есть ли важные сроки. При необходимости добавьте свои фотографии, голосовое сообщение или видеокружок. Проверьте запись до публикации и не прикладывайте конфиденциальные документы." },
      { title: "Укажите, куда получать поддержку", text: "Выберите каждый принимаемый актив и вставьте адрес получения именно для его основной сети (mainnet). Сверьте адрес в кошельке. Аккаунт для входа — не платёжный адрес. Нужен хотя бы один криптоадрес либо настроенная экспериментальная опция СБП, включённая для этого поста." },
      { title: "Опубликуйте пост и поделитесь ссылкой", text: "Проверьте никнейм, текст, вложения и реквизиты, затем опубликуйте пост. Откройте его отдельную страницу и нажмите Share («Поделиться») или скопируйте адрес из браузера. Реквизиты сохраняются в посте: последующее изменение профиля не перенаправит его кнопку Fund на другой адрес." },
    ],
    supportTitle: "Поддержите человека, проверяя каждый шаг.",
    supportSteps: [
      { title: "Прочитайте пост до перевода", text: "Откройте пост, прочитайте комментарии и посмотрите публичный профиль автора. При необходимости задайте вопросы. Публичный профиль и история транзакций не подтверждают правдивость рассказа." },
      { title: "Выберите предложенный актив и сеть", text: "Войдите и нажмите Fund («Поддержать»). Выберите один из доступных способов получения и укажите сумму. В вашем кошельке должны совпадать и актив, и сеть: USDT в Ethereum — не то же самое, что USDT в TRON или Solana." },
      { title: "Проверьте и подтвердите перевод в кошельке", text: "На последнем экране кошелька проверьте получателя, сумму, актив, сеть и комиссии. Совместимый подключённый кошелёк может выполнить перевод напрямую. Для других способов доступны платёжный запрос, QR-код или адрес для приложения отправителя; поддержка зависит от кошелька." },
      { title: "Вернитесь и проверьте результат", text: "После ручного перевода вставьте идентификатор транзакции в окне поддержки для проверки. Отправленная или ожидающая подтверждения транзакция ещё не считается проверенным пожертвованием. Если она ожидает подтверждения, проверьте ссылку на обозреватель блокчейна и повторите проверку, а не перевод." },
    ],
    fees: "Money Nerds не берёт комиссию платформы и не хранит пользовательский баланс. Возможны комиссии сети и сервиса отправителя.",
    networksTitle: "Один и тот же актив. Одна и та же сеть. Всегда.",
    networksIntroduction: "Это доступные криптовалютные направления. В каждом посте показаны только реквизиты, выбранные автором. Все переводы — в основных сетях (mainnet).",
    networks: [
      ["Solana", "SOL, USDC и USDT в сети Solana"],
      ["Ethereum", "ETH и USDT в сети Ethereum (ERC-20)"],
      ["Bitcoin", "BTC в сети Bitcoin"],
      ["TRON", "TRX и USDT в сети TRON (TRC-20)"],
      ["TON", "TON в сети The Open Network"],
      ["Injective", "INJ в сети Injective"],
    ],
    sbpTitle: "СБП — отдельная экспериментальная возможность.",
    sbpParagraphs: [
      "Личные банковские переводы через СБП по умолчанию выключены. Включите их в настройках; для получения также нужны ваш номер телефона с +7 и банк получателя. Добавляйте СБП отдельно в каждый новый пост. Открыть реквизиты могут только вошедшие пользователи, которые тоже включили эту опцию, но они по-прежнему могут скопировать их или передать другим.",
      "Поддерживаемая ссылка на сбор, выданная банком, может открыть банковский сценарий перевода. Без такой ссылки QR-код открывает закрытую страницу с инструкциями, а не банковский платёжный запрос: реквизиты нужно ввести самостоятельно. Возможны банковские комиссии. Переводы СБП не входят в подтверждённые криптовалютные итоги. Перед публикацией реквизитов прочитайте руководство по безопасности.",
    ],
    links: {
      composer: "Создать пост",
      build: "Build — проекты",
      mutualAid: "Mutual Aid — взаимопомощь",
      transparency: "Как движутся средства (на английском)",
      settings: "Настройки",
      safety: "Безопасность (на английском)",
      related: "Другие руководства на английском",
      faq: "Частые вопросы (на английском)",
      community: "Руководство сообщества (на английском)",
    },
    callout: {
      kicker: "Начните с реального человека",
      title: "Найдите просьбу, которая вам близка.",
      text: "Читайте доску без входа. Изучайте контекст, задавайте вопросы и сами решайте, хотите ли поддержать.",
      action: "Открыть доску",
    },
  },
  es: {
    label: "Cómo funciona",
    title: "Tu primera petición. Tu primer gesto de apoyo.",
    description: "Aprende a publicar en Money Nerds, elegir direcciones de recepción y apoyar a alguien directamente en la red de criptomonedas correcta.",
    introduction: "Money Nerds es un tablón público para ideas, memes, proyectos creativos y necesidades reales. Una publicación inicia la conversación; el apoyo llega directamente al destino de recepción que proporciona su autor.",
    breadcrumbLabel: "Ruta de navegación",
    createTitle: "Haz una petición que se entienda.",
    createSteps: [
      { title: "Inicia sesión y elige una categoría", text: "Usa una de las opciones disponibles en la pantalla de acceso. Abre el formulario del tablón o empieza en una categoría como Build («Proyectos») o Mutual Aid («Ayuda mutua»). La categoría de la página estará seleccionada; puedes cambiarla antes de publicar." },
      { title: "Explica el contexto", text: "Elige un apodo público y explica qué quieres hacer, qué cubriría el apoyo y los plazos relevantes. Añade imágenes propias, un mensaje de voz o un vídeo circular si ayudan. Revisa las grabaciones antes de publicar y no adjuntes documentos privados." },
      { title: "Elige dónde recibir el apoyo", text: "Selecciona cada activo que aceptas y pega tu dirección de recepción para esa red principal concreta (mainnet). Comprueba la dirección en tu cartera. Una cuenta de acceso no es una dirección de pago. Necesitas al menos un destino de criptomonedas, o la opción experimental SBP configurada e incluida en esta publicación." },
      { title: "Publica y comparte la publicación", text: "Revisa el apodo, el texto, los archivos y los destinos antes de publicar. Abre la página individual y pulsa Share («Compartir») o copia la URL del navegador. Los destinos se guardan con la publicación: cambiar tu perfil después no redirige silenciosamente su botón Fund a otra dirección." },
    ],
    supportTitle: "Apoya a alguien, comprobando cada paso.",
    supportSteps: [
      { title: "Lee antes de aportar", text: "Abre la publicación, lee sus comentarios y consulta el perfil público del autor. Pide aclaraciones si las necesitas. Un perfil público o un historial de transacciones no verifica la veracidad de una historia." },
      { title: "Elige un activo y una red disponibles", text: "Inicia sesión y pulsa Fund («Apoyar»). Elige uno de los destinos disponibles del destinatario e introduce el importe. El activo y la red deben coincidir con los de tu cartera: USDT en Ethereum no es USDT en TRON ni en Solana." },
      { title: "Revisa y aprueba en tu cartera", text: "Comprueba el destinatario, el importe, el activo, la red y las comisiones en la pantalla final de tu cartera. Una cartera conectada y compatible puede ejecutar la transferencia directamente. Otros destinos ofrecen una solicitud de pago, un código QR o una dirección para usar en la aplicación desde la que envías; la compatibilidad varía según la cartera." },
      { title: "Vuelve para comprobar el resultado", text: "Si hiciste una transferencia manual, pega su identificador en el cuadro de aportación para verificarla. Una transacción enviada o pendiente todavía no es una donación verificada. Si sigue pendiente, consulta su enlace al explorador y vuelve a intentar la verificación en vez de enviar el dinero otra vez." },
    ],
    fees: "Money Nerds no cobra comisión de plataforma ni mantiene un saldo de usuario. Pueden aplicarse comisiones de red y del proveedor desde el que envías.",
    networksTitle: "El mismo activo. La misma red. Siempre.",
    networksIntroduction: "Estas son las opciones disponibles para criptomonedas. Cada publicación ofrece solo los destinos que seleccionó su autor; todos utilizan redes principales (mainnet).",
    networks: [
      ["Solana", "SOL, USDC y USDT en Solana"],
      ["Ethereum", "ETH y USDT en Ethereum (ERC-20)"],
      ["Bitcoin", "BTC en Bitcoin"],
      ["TRON", "TRX y USDT en TRON (TRC-20)"],
      ["TON", "TON en The Open Network"],
      ["Injective", "INJ en Injective"],
    ],
    sbpTitle: "SBP es una opción experimental independiente.",
    sbpParagraphs: [
      "Las transferencias bancarias personales mediante SBP están desactivadas por defecto. Actívalas en ajustes; para recibir también necesitas tu número de teléfono con +7 y un banco receptor. Incluye SBP por separado en cada nueva publicación. Solo las personas que hayan iniciado sesión y activado esta opción pueden revelar los datos, pero aun así pueden copiarlos o compartirlos.",
      "Un enlace de recaudación compatible emitido por el banco puede abrir su proceso de transferencia. Sin él, el QR abre instrucciones privadas, no una solicitud de pago bancaria, y tendrás que introducir los datos manualmente. Pueden aplicarse comisiones bancarias. Las transferencias SBP no se incluyen en los totales de donaciones en criptomonedas verificadas. Consulta la guía de seguridad antes de compartir datos de recepción.",
    ],
    links: {
      composer: "Crear una publicación",
      build: "Build — proyectos",
      mutualAid: "Mutual Aid — ayuda mutua",
      transparency: "Cómo se mueven los fondos (en inglés)",
      settings: "Ajustes",
      safety: "Seguridad (en inglés)",
      related: "Otras guías en inglés",
      faq: "Preguntas frecuentes (en inglés)",
      community: "Guía de la comunidad (en inglés)",
    },
    callout: {
      kicker: "Empieza por una persona real",
      title: "Encuentra una petición que te importe.",
      text: "Explora sin iniciar sesión. Lee el contexto, haz preguntas y decide si quieres apoyar.",
      action: "Explorar el tablón",
    },
  },
  zh: {
    label: "使用指南",
    title: "发出第一份请求，给予第一份支持。",
    description: "了解如何在 Money Nerds 发布帖子、设置收款地址，并在正确的加密货币网络上直接支持他人。",
    introduction: "Money Nerds 是一个公开的社区信息板，用于分享想法、梗图、创作和真实需求。帖子开启交流，而支持款项会直接转到作者提供的收款地址或收款方式。",
    breadcrumbLabel: "面包屑导航",
    createTitle: "把你的请求说明白。",
    createSteps: [
      { title: "登录并选择分类", text: "使用登录页面提供的方式登录。打开信息板的发帖表单，或从 Build（项目）和 Mutual Aid（互助）等分类开始。表单会预选当前页面的分类；发布前仍可更改。" },
      { title: "说明背景和用途", text: "选择公开昵称，说明你想做什么、支持款项将用于什么，以及相关时间安排。如有帮助，可以添加自己的图片、语音消息或圆形视频。发布前先预览录制内容，不要上传私人文件。" },
      { title: "选择接收支持的方式", text: "选择你接受的每种资产，并粘贴该资产对应主网（mainnet）的收款地址。请在钱包中核对地址。登录账号不等于收款地址。你需要至少一个加密货币收款地址，或为本帖启用已配置好的实验性 SBP 收款方式。" },
      { title: "发布并分享帖子链接", text: "核对昵称、正文、附件和收款信息后再发布。打开帖子的独立页面，点击 Share（分享），或复制浏览器中的网址。收款信息会保存在帖子中：之后修改个人资料不会悄悄改变该帖 Fund 按钮的收款目标。" },
    ],
    supportTitle: "逐步核对，再给予支持。",
    supportSteps: [
      { title: "转账前先阅读", text: "打开帖子，阅读评论并查看作者的公开资料。如有疑问，先询问清楚。公开资料或交易记录并不能证明故事的真实性。" },
      { title: "选择对方提供的资产和网络", text: "登录并点击 Fund（支持）。选择收款人提供的一种方式，然后输入金额。发送钱包中的资产和网络都必须匹配：Ethereum 上的 USDT 不等于 TRON 或 Solana 上的 USDT。" },
      { title: "在钱包内检查并确认", text: "在钱包最终确认页面核对收款人、金额、资产、网络和手续费。兼容的已连接钱包可能直接执行转账。其他方式会提供付款请求、二维码或地址，供你在发送应用中使用；具体支持情况因钱包而异。" },
      { title: "返回并检查结果", text: "如果你手动完成转账，请在支持对话框中粘贴交易 ID 进行核验。已提交或待确认的交易还不算已核验的捐赠。如果交易仍在等待确认，请打开区块链浏览器链接查看，并重试核验，不要再次转账。" },
    ],
    fees: "Money Nerds 不收取平台佣金，也不保管用户余额。网络和发送服务提供商仍可能收取手续费。",
    networksTitle: "资产一致，网络一致，每次都要核对。",
    networksIntroduction: "以下是可用的加密货币收款方式。每个帖子只提供作者所选的收款目标；所有方式均使用主网（mainnet）。",
    networks: [
      ["Solana", "Solana 网络上的 SOL、USDC 和 USDT"],
      ["Ethereum", "Ethereum 网络上的 ETH 和 USDT（ERC-20）"],
      ["Bitcoin", "Bitcoin 网络上的 BTC"],
      ["TRON", "TRON 网络上的 TRX 和 USDT（TRC-20）"],
      ["TON", "The Open Network 上的 TON"],
      ["Injective", "Injective 网络上的 INJ"],
    ],
    sbpTitle: "SBP 是单独的实验性选项。",
    sbpParagraphs: [
      "通过俄罗斯快速支付系统 SBP 进行的个人银行转账默认关闭。可在设置中启用；收款还需要你以 +7 开头的电话号码和收款银行。每个新帖子都需要单独勾选 SBP。只有已登录且同样启用此选项的用户才能查看这些收款信息，但他们仍可复制或分享这些信息。",
      "兼容的银行官方收款链接可能打开银行的转账流程。没有这类链接时，二维码打开的是受限的操作说明，而非银行付款请求，你需要自行填写收款信息。银行可能收取手续费。SBP 转账不计入已核验的加密货币捐赠总额。分享收款信息前，请先阅读安全指南。",
    ],
    links: {
      composer: "创建帖子",
      build: "Build — 项目",
      mutualAid: "Mutual Aid — 互助",
      transparency: "资金如何流转（英文）",
      settings: "设置",
      safety: "安全指南（英文）",
      related: "其他英文指南",
      faq: "常见问题（英文）",
      community: "社区指南（英文）",
    },
    callout: {
      kicker: "从一个真实的人开始",
      title: "找到你愿意关注的请求。",
      text: "无需登录即可浏览。了解背景、提出问题，再决定是否给予支持。",
      action: "浏览信息板",
    },
  },
} satisfies Record<TranslatedGuideLocale, GuideTranslation>;
