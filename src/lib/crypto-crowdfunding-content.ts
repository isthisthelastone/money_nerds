import type { Locale } from "@/lib/i18n/config";
import type { Category } from "@/lib/models";

interface ContentBlock {
  title: string;
  text: string;
}

export interface CryptoCrowdfundingContent {
  label: string;
  metadataTitle: string;
  metadataDescription: string;
  title: string;
  introduction: string;
  breadcrumbLabel: string;
  browseLabel: string;
  howLabel: string;
  factsLabel: string;
  facts: readonly ContentBlock[];
  usesTitle: string;
  usesIntroduction: string;
  uses: readonly (ContentBlock & { category: Exclude<Category, "anything"> })[];
  networksTitle: string;
  networksIntroduction: string;
  networkColumn: string;
  assetsColumn: string;
  networkNote: string;
  stepsTitle: string;
  steps: readonly ContentBlock[];
  boundariesTitle: string;
  boundaries: readonly string[];
  faqTitle: string;
  questions: readonly ContentBlock[];
  resourcesTitle: string;
  resourcesIntroduction: string;
  resources: {
    how: string;
    transparency: string;
    safety: string;
    community: string;
    faq: string;
    terms: string;
    contact: string;
  };
}

// These complete editorial translations are URL-addressable content, independent
// of a visitor's saved interface language. Asset symbols come from payout config.
const CONTENT: Record<Locale, CryptoCrowdfundingContent> = {
  en: {
    label: "Crypto crowdfunding",
    metadataTitle: "Crypto crowdfunding for people, memes and creative work",
    metadataDescription: "Explore direct crypto crowdfunding on Money Nerds: memes, creative projects and personal needs, supported networks, and 0% platform commission. Network fees apply.",
    title: "Crypto crowdfunding, from one person to another.",
    introduction: "Money Nerds is a public crypto crowdfunding board for memes, creative work, projects and personal needs. People publish requests, choose the currencies they accept, and receive voluntary support directly at their own addresses. Money Nerds takes no platform commission and does not hold user funds; network and sending-provider fees may apply.",
    breadcrumbLabel: "Breadcrumb",
    browseLabel: "Explore requests",
    howLabel: "How to post or support someone",
    factsLabel: "How support works",
    facts: [
      { title: "0% platform commission", text: "Money Nerds adds no percentage to user donations. Review network and sending-provider fees before confirming." },
      { title: "Direct to the recipient", text: "Support goes to the destination shown for the request. There is no Money Nerds balance to withdraw." },
      { title: "Read before signing in", text: "Browse posts, discussions and public profiles first. Sign in when you want to participate." },
    ],
    usesTitle: "A place for a small idea or a real need.",
    usesIntroduction: "Choose the closest category, explain what support would cover, and let readers decide. These are examples of suitable requests, not promises of funding.",
    uses: [
      { category: "memes", title: "Memes", text: "Share your own internet humor or a playful idea. People can support the creator without buying a collectible." },
      { category: "art", title: "Art and creative work", text: "Show a drawing, song, piece of writing or work in progress, and explain the next step that support could help you take." },
      { category: "build", title: "Projects and experiments", text: "Describe a prototype, open-source contribution or small project, including what is ready and what remains to be done." },
      { category: "mutual-aid", title: "Mutual aid", text: "Explain a personal or community need clearly. Share only the context you have permission to make public." },
      { category: "animals", title: "Animal support", text: "Explain a rescue, food, shelter or veterinary-care need and how you intend to use support." },
      { category: "crowdfunding", title: "Crowdfunding", text: "Bring together voluntary contributions for a project or personal goal and discuss progress in the comments." },
    ],
    networksTitle: "Choose the asset and its exact network.",
    networksIntroduction: "Money Nerds supports the following mainnet routes. Each post offers only the destinations its author selected; a supporter chooses from those options.",
    networkColumn: "Network",
    assetsColumn: "Supported assets",
    networkNote: "USDT on Ethereum, TRON and Solana are different routes. Money Nerds does not exchange assets or bridge networks. Your sending wallet must match both the selected asset and network.",
    stepsTitle: "From a public request to direct support.",
    steps: [
      { title: "Publish a clear request", text: "Sign in through an available method, choose a category, and add a nickname, text or media. Select accepted assets and receiving addresses. Signing in does not create a crypto wallet." },
      { title: "Share the post and discuss it", text: "Every post has its own public link. Readers can review the request, inspect the profile, and ask questions before deciding whether to help." },
      { title: "Choose a route and approve the transfer", text: "The supporter signs in, opens Fund, selects an offered asset and reviews the destination, amount and fees in a compatible wallet or sending app. Wallet and device support vary." },
      { title: "Check the transaction", text: "For a manual route, return with the transaction ID for verification. Pending is not verified: check the explorer and retry verification instead of sending again." },
    ],
    boundariesTitle: "Know what direct support does—and does not—provide.",
    boundaries: [
      "Money Nerds provides a public request and discussion flow, not escrow or all-or-nothing campaign settlement. Contributions do not buy equity or a promised financial return. Confirmed blockchain transfers cannot be reversed by Money Nerds.",
      "A verified donation records a matching on-chain transfer. It does not verify the author's story, charity status, ownership of a self-declared address, or eventual use of funds. Funding and project outcomes are not guaranteed.",
      "Experimental SBP bank-transfer instructions are separate and off by default. Both participants must opt in before receiving details are shown. Money Nerds cannot confirm bank transfers or include them in verified crypto totals.",
    ],
    faqTitle: "Questions before you choose a platform.",
    questions: [
      { title: "Can a meme or comment receive support?", text: "Yes. Memes and other public requests can offer funding routes. Comments can also be funded when the commenter has receiving options. Check whose destination the Fund dialog displays." },
      { title: "Can I receive USDT donations?", text: "Yes, through the supported Solana, Ethereum (ERC-20) or TRON (TRC-20) route you add to your post. Publish an address for the exact network you accept; the token name alone is not enough." },
      { title: "Do I need to mint, mine or buy an NFT?", text: "No. Money Nerds is a direct-support board. It does not mint or mine NFTs, sell collectibles, or require an NFT purchase to support a person." },
      { title: "Is there a minimum audience or guaranteed payout?", text: "You can publish without bringing an established audience, but publication does not guarantee contributions. There is no pooled platform payout: support settles directly to the selected recipient address." },
    ],
    resourcesTitle: "Read the details, then meet the people.",
    resourcesIntroduction: "Use the practical guide to get started, review the fee and safety information, or contact Money Nerds with a question about the service.",
    resources: { how: "Step-by-step guide", transparency: "Fees and transparency", safety: "Safety and privacy", community: "Writing and sharing a request", faq: "All frequently asked questions", terms: "Terms of use", contact: "Contact and reporting" },
  },
  es: {
    label: "Financiación colectiva con criptomonedas",
    metadataTitle: "Financiación colectiva con criptomonedas para personas, memes y creadores",
    metadataDescription: "Apoya memes, proyectos creativos y necesidades personales en Money Nerds mediante criptomonedas. Comisión de plataforma del 0%; se aplican costes de red.",
    title: "Financiación colectiva con criptomonedas, de persona a persona.",
    introduction: "Money Nerds es un tablón público de financiación colectiva con criptomonedas para memes, trabajos creativos, proyectos y necesidades personales. Cada persona publica su petición, elige las monedas que acepta y recibe apoyo voluntario directamente en sus direcciones. Money Nerds no cobra comisión de plataforma ni custodia fondos; pueden aplicarse comisiones de red y del servicio de envío.",
    breadcrumbLabel: "Ruta de navegación",
    browseLabel: "Explorar peticiones",
    howLabel: "Cómo publicar o apoyar a alguien",
    factsLabel: "Cómo funciona el apoyo",
    facts: [
      { title: "0% de comisión de plataforma", text: "Money Nerds no añade un porcentaje a las donaciones entre usuarios. Revisa las comisiones de red y del servicio de envío antes de confirmar." },
      { title: "Directamente al destinatario", text: "El apoyo llega al destino mostrado para la petición. No hay un saldo de Money Nerds que debas retirar." },
      { title: "Lee antes de iniciar sesión", text: "Explora primero las publicaciones, las conversaciones y los perfiles públicos. Inicia sesión cuando quieras participar." },
    ],
    usesTitle: "Un lugar para una pequeña idea o una necesidad real.",
    usesIntroduction: "Elige la categoría más adecuada, explica qué cubriría el apoyo y deja que los lectores decidan. Son ejemplos de peticiones que encajan, no promesas de financiación.",
    uses: [
      { category: "memes", title: "Memes", text: "Comparte tu propio humor de internet o una idea divertida. Las personas pueden apoyar al creador sin comprar un objeto coleccionable." },
      { category: "art", title: "Arte y trabajo creativo", text: "Muestra un dibujo, una canción, un texto o una obra en proceso y explica qué siguiente paso podría facilitar el apoyo." },
      { category: "build", title: "Proyectos y experimentos", text: "Describe un prototipo, una contribución de código abierto o un proyecto pequeño, indicando qué está listo y qué falta por hacer." },
      { category: "mutual-aid", title: "Ayuda mutua", text: "Explica con claridad una necesidad personal o comunitaria. Comparte solo información que tengas permiso para hacer pública." },
      { category: "animals", title: "Apoyo a animales", text: "Explica una necesidad de rescate, alimentación, refugio o atención veterinaria y cómo piensas utilizar el apoyo." },
      { category: "crowdfunding", title: "Financiación colectiva", text: "Reúne aportaciones voluntarias para un proyecto o una meta personal y conversa sobre el progreso en los comentarios." },
    ],
    networksTitle: "Elige el activo y su red exacta.",
    networksIntroduction: "Money Nerds admite las siguientes redes principales. Cada publicación ofrece solo los destinos seleccionados por su autor; quien apoya elige entre esas opciones.",
    networkColumn: "Red",
    assetsColumn: "Activos admitidos",
    networkNote: "USDT en Ethereum, TRON y Solana son vías diferentes. Money Nerds no cambia activos ni los transfiere entre redes. Tu cartera de envío debe coincidir tanto con el activo como con la red seleccionados.",
    stepsTitle: "De una petición pública al apoyo directo.",
    steps: [
      { title: "Publica una petición clara", text: "Inicia sesión con un método disponible, elige una categoría y añade un apodo, texto o contenido multimedia. Selecciona los activos aceptados y las direcciones de recepción. Iniciar sesión no crea una cartera de criptomonedas." },
      { title: "Comparte la publicación y conversa", text: "Cada publicación tiene su propio enlace público. Los lectores pueden revisar la petición, consultar el perfil y hacer preguntas antes de decidir si quieren ayudar." },
      { title: "Elige una vía y aprueba la transferencia", text: "Quien apoya inicia sesión, pulsa Apoyar, selecciona un activo ofrecido y revisa el destino, el importe y las comisiones en una cartera o aplicación de envío compatible. La compatibilidad depende de la cartera y del dispositivo." },
      { title: "Comprueba la transacción", text: "En una transferencia manual, vuelve con el identificador de transacción para verificarla. Pendiente no significa verificada: consulta el explorador y vuelve a intentar la verificación en lugar de enviar otra vez." },
    ],
    boundariesTitle: "Qué ofrece el apoyo directo y cuáles son sus límites.",
    boundaries: [
      "Money Nerds ofrece publicaciones y conversaciones públicas, no custodia en garantía ni liquidación de campañas de todo o nada. Las aportaciones no compran participaciones ni prometen rentabilidad. Money Nerds no puede revertir transferencias confirmadas en la cadena de bloques.",
      "Una donación verificada registra una transferencia coincidente en la cadena. No verifica la historia del autor, su condición de entidad benéfica, la titularidad de una dirección declarada ni el uso final de los fondos. No se garantizan la financiación ni los resultados de un proyecto.",
      "Las instrucciones experimentales de transferencias bancarias SBP son independientes y están desactivadas por defecto. Ambos participantes deben activarlas para que se muestren los datos de recepción. Money Nerds no puede confirmar transferencias bancarias ni incluirlas en los totales de criptomonedas verificadas.",
    ],
    faqTitle: "Preguntas antes de elegir una plataforma.",
    questions: [
      { title: "¿Puede recibir apoyo un meme o un comentario?", text: "Sí. Los memes y otras peticiones públicas pueden ofrecer vías de financiación. También se pueden apoyar comentarios cuando su autor tiene opciones de recepción. Comprueba de quién es el destino que muestra el cuadro de apoyo." },
      { title: "¿Puedo recibir donaciones en USDT?", text: "Sí, mediante la vía admitida de Solana, Ethereum (ERC-20) o TRON (TRC-20) que añadas a tu publicación. Publica una dirección para la red exacta que aceptas; el nombre del token no basta." },
      { title: "¿Tengo que acuñar, minar o comprar un NFT?", text: "No. Money Nerds es un tablón de apoyo directo. No acuña ni mina NFT, no vende objetos coleccionables ni exige comprar un NFT para apoyar a una persona." },
      { title: "¿Necesito una audiencia mínima o hay un pago garantizado?", text: "Puedes publicar sin una audiencia previa, pero publicar no garantiza aportaciones. No existe un pago desde un fondo común de la plataforma: el apoyo llega directamente a la dirección del destinatario seleccionado." },
    ],
    resourcesTitle: "Conoce los detalles y después a las personas.",
    resourcesIntroduction: "Empieza con la guía práctica, consulta la información sobre comisiones y seguridad o contacta con Money Nerds si tienes una pregunta sobre el servicio.",
    resources: { how: "Guía paso a paso", transparency: "Comisiones y transparencia", safety: "Seguridad y privacidad", community: "Cómo escribir y compartir una petición", faq: "Todas las preguntas frecuentes", terms: "Condiciones de uso", contact: "Contacto y avisos" },
  },
  zh: {
    label: "加密货币众筹",
    metadataTitle: "为个人、表情包和创意作品提供加密货币众筹",
    metadataDescription: "在 Money Nerds 用加密货币直接支持表情包、创意项目和个人需求。了解支持的网络和零平台佣金机制；网络手续费仍可能产生。",
    title: "人与人之间的加密货币众筹。",
    introduction: "Money Nerds 是面向表情包、创意作品、项目和个人需求的公开加密货币众筹社区。用户发布请求，选择接受的币种，并在自己的地址直接接收自愿支持。Money Nerds 不收取平台佣金，也不托管用户资金；网络或转账服务仍可能收取费用。",
    breadcrumbLabel: "导航路径",
    browseLabel: "浏览请求",
    howLabel: "如何发布或支持他人",
    factsLabel: "支持方式",
    facts: [
      { title: "零平台佣金", text: "Money Nerds 不从用户之间的捐赠中抽成。确认前，请检查网络和转账服务收取的费用。" },
      { title: "直接到达收款人", text: "支持款项转入请求中显示的收款地址，无须从 Money Nerds 平台余额中提现。" },
      { title: "登录前即可阅读", text: "先浏览帖子、讨论和公开个人主页。想参与时再登录。" },
    ],
    usesTitle: "小创意和真实需求，都可以有自己的位置。",
    usesIntroduction: "选择最合适的分类，说明支持款项的用途，让读者自行决定。以下是适合发布的请求示例，并非获得资助的承诺。",
    uses: [
      { category: "memes", title: "表情包与网络幽默", text: "分享自己的网络笑话或有趣创意。读者可以直接支持创作者，无须购买收藏品。" },
      { category: "art", title: "艺术与创作", text: "展示绘画、歌曲、文字或创作中的作品，说明支持能帮助你完成哪一步。" },
      { category: "build", title: "项目与实验", text: "介绍原型、开源贡献或小型项目，说明哪些部分已经完成，哪些仍待实现。" },
      { category: "mutual-aid", title: "互助", text: "清楚说明个人或社区的需求。只分享你有权公开的背景信息。" },
      { category: "animals", title: "动物援助", text: "说明救助、食物、收容或兽医诊疗需求，以及你计划如何使用支持款项。" },
      { category: "crowdfunding", title: "众筹", text: "为项目或个人目标汇集自愿支持，并在评论中交流进展。" },
    ],
    networksTitle: "同时选择资产和准确的网络。",
    networksIntroduction: "Money Nerds 支持以下主网转账方式。每条帖子仅提供作者选定的收款选项，支持者从中选择。",
    networkColumn: "网络",
    assetsColumn: "支持的资产",
    networkNote: "Ethereum、TRON 和 Solana 上的 USDT 属于不同转账方式。Money Nerds 不提供资产兑换或跨链服务。发送钱包中的资产与网络都必须和所选方式一致。",
    stepsTitle: "从公开请求到直接支持。",
    steps: [
      { title: "发布清楚的请求", text: "使用页面提供的方式登录，选择分类，添加昵称、文字或媒体。选择接受的资产并填写收款地址。登录账号并不会创建加密货币钱包。" },
      { title: "分享帖子，展开讨论", text: "每条帖子都有自己的公开链接。读者可以查看请求和个人主页，先提问，再决定是否支持。" },
      { title: "选择转账方式并批准", text: "支持者登录后点击支持，选择对方提供的资产，并在兼容的钱包或转账应用中核对收款地址、金额和费用。兼容情况取决于钱包和设备。" },
      { title: "检查交易", text: "使用手动转账方式时，请返回并提交交易标识以进行核验。待处理不等于已核验：查看区块浏览器并重试核验，不要因此重复转账。" },
    ],
    boundariesTitle: "了解直接支持的作用和边界。",
    boundaries: [
      "Money Nerds 提供公开请求和讨论功能，不提供托管担保或全有全无式众筹结算。支持款项不会换取股权或承诺的投资回报。Money Nerds 无法撤销已确认的区块链转账。",
      "捐赠核验确认的是匹配的链上转账，不代表核实了作者的故事、慈善机构身份、自行声明地址的所有权或资金最终用途。不保证获得资助或实现项目目标。",
      "实验性的 SBP 银行转账说明是独立选项，默认关闭。双方都启用后才能查看收款信息。Money Nerds 无法确认银行转账，也不会将其计入已核验的加密货币总额。",
    ],
    faqTitle: "选择平台前，你可能想知道。",
    questions: [
      { title: "表情包或评论也能获得支持吗？", text: "可以。表情包和其他公开请求都能提供收款方式。评论作者有收款选项时，也可以支持评论。请核对支持窗口显示的是谁的收款地址。" },
      { title: "可以接收 USDT 捐赠吗？", text: "可以，在帖子中添加受支持的 Solana、Ethereum（ERC-20）或 TRON（TRC-20）收款方式即可。地址必须属于你接受的确切网络，仅凭代币名称还不够。" },
      { title: "需要铸造、挖掘或购买 NFT 吗？", text: "不需要。Money Nerds 是直接支持社区，不提供 NFT 铸造或挖掘，不销售收藏品，也不要求购买 NFT 才能支持他人。" },
      { title: "需要一定数量的粉丝吗？能保证收到钱吗？", text: "没有现成的受众也可以发布，但发布不代表一定获得支持。平台没有资金池统一付款，款项直接转入所选收款地址。" },
    ],
    resourcesTitle: "了解规则，再认识这里的人。",
    resourcesIntroduction: "从实用指南开始，查看费用与安全说明，或联系 Money Nerds 咨询服务相关问题。",
    resources: { how: "操作指南", transparency: "费用与透明度", safety: "安全与隐私", community: "撰写和分享请求", faq: "全部常见问题", terms: "使用条款", contact: "联系与举报" },
  },
  ru: {
    label: "Краудфандинг в криптовалюте",
    metadataTitle: "Краудфандинг в криптовалюте для людей, мемов и творчества",
    metadataDescription: "Поддерживайте мемы, творческие проекты и личные просьбы криптовалютой на Money Nerds. Комиссия платформы — 0%; комиссии сети сохраняются.",
    title: "Краудфандинг в криптовалюте — от человека к человеку.",
    introduction: "Money Nerds — открытая площадка для краудфандинга в криптовалюте: мемов, творчества, проектов и личных просьб. Люди публикуют обращения, выбирают принимаемые валюты и получают добровольную поддержку прямо на свои адреса. Money Nerds не берёт комиссию платформы и не хранит средства пользователей; возможны комиссии сети и сервиса отправки.",
    breadcrumbLabel: "Навигационная цепочка",
    browseLabel: "Посмотреть просьбы",
    howLabel: "Как опубликовать просьбу или поддержать человека",
    factsLabel: "Как устроена поддержка",
    facts: [
      { title: "0% комиссии платформы", text: "Money Nerds не удерживает процент с переводов между пользователями. Проверьте комиссии сети и сервиса отправки перед подтверждением." },
      { title: "Напрямую получателю", text: "Поддержка поступает по реквизитам, указанным для просьбы. Выводить деньги с баланса Money Nerds не требуется — такого баланса нет." },
      { title: "Читайте до входа в аккаунт", text: "Сначала посмотрите посты, обсуждения и публичные профили. Войдите, когда захотите участвовать." },
    ],
    usesTitle: "Место для небольшой идеи и настоящей нужды.",
    usesIntroduction: "Выберите подходящую категорию, объясните, на что пойдёт поддержка, и дайте читателям решить. Это примеры уместных просьб, а не обещания финансирования.",
    uses: [
      { category: "memes", title: "Мемы", text: "Делитесь собственным интернет-юмором или забавной идеей. Поддержать автора можно без покупки коллекционного предмета." },
      { category: "art", title: "Искусство и творчество", text: "Покажите рисунок, песню, текст или работу в процессе и объясните, какой следующий шаг поможет сделать поддержка." },
      { category: "build", title: "Проекты и эксперименты", text: "Расскажите о прототипе, вкладе в открытый код или небольшом проекте: что уже готово и что ещё предстоит сделать." },
      { category: "mutual-aid", title: "Взаимопомощь", text: "Понятно опишите личную или общую нужду. Публикуйте только те сведения, которыми вы вправе делиться открыто." },
      { category: "animals", title: "Помощь животным", text: "Объясните потребность в спасении, корме, приюте или ветеринарной помощи и расскажите, как планируете использовать поддержку." },
      { category: "crowdfunding", title: "Краудфандинг", text: "Собирайте добровольные взносы на проект или личную цель и обсуждайте прогресс в комментариях." },
    ],
    networksTitle: "Выберите актив и его точную сеть.",
    networksIntroduction: "Money Nerds поддерживает перечисленные основные сети. Каждый пост предлагает только способы получения, выбранные автором; отправитель выбирает из них.",
    networkColumn: "Сеть",
    assetsColumn: "Поддерживаемые активы",
    networkNote: "USDT в Ethereum, TRON и Solana — разные способы перевода. Money Nerds не обменивает активы и не переводит их между сетями. В кошельке отправителя должны совпадать и выбранный актив, и сеть.",
    stepsTitle: "От публичной просьбы к прямой поддержке.",
    steps: [
      { title: "Опубликуйте понятную просьбу", text: "Войдите доступным способом, выберите категорию и добавьте никнейм, текст или медиа. Укажите принимаемые активы и адреса получения. Вход в аккаунт не создаёт криптокошелёк." },
      { title: "Поделитесь постом и обсудите его", text: "У каждого поста есть собственная публичная ссылка. Читатели могут изучить просьбу и профиль, задать вопросы и затем решить, помогать ли." },
      { title: "Выберите способ и подтвердите перевод", text: "Отправитель входит, нажимает «Поддержать», выбирает предлагаемый актив и проверяет адрес, сумму и комиссии в совместимом кошельке или приложении. Поддержка зависит от кошелька и устройства." },
      { title: "Проверьте транзакцию", text: "После ручного перевода вернитесь с идентификатором транзакции для проверки. Ожидание не означает подтверждение: посмотрите обозреватель сети и повторите проверку, а не сам перевод." },
    ],
    boundariesTitle: "Что даёт прямая поддержка — и чего она не обещает.",
    boundaries: [
      "Money Nerds предоставляет публичные просьбы и обсуждения, но не эскроу и не сборы по принципу «всё или ничего». Взносы не дают долю в проекте или обещанный финансовый доход. Money Nerds не может отменить подтверждённый перевод в блокчейне.",
      "Проверенное пожертвование означает соответствующий запросу перевод в блокчейне. Это не проверка истории автора, благотворительного статуса, владения самостоятельно указанным адресом или дальнейшего использования денег. Финансирование и результат проекта не гарантируются.",
      "Экспериментальные инструкции для банковских переводов через СБП — отдельная возможность, по умолчанию отключённая. Оба участника должны включить её, чтобы увидеть реквизиты. Money Nerds не может подтверждать банковские переводы и не включает их в проверенные криптовалютные суммы.",
    ],
    faqTitle: "Вопросы перед выбором площадки.",
    questions: [
      { title: "Можно поддержать мем или комментарий?", text: "Да. Мемы и другие публичные просьбы могут содержать способы получения поддержки. Комментарий тоже можно поддержать, если его автор добавил реквизиты. Проверьте, чьи реквизиты показаны в окне поддержки." },
      { title: "Можно получать пожертвования в USDT?", text: "Да, через добавленный в пост поддерживаемый вариант Solana, Ethereum (ERC-20) или TRON (TRC-20). Укажите адрес именно той сети, в которой принимаете перевод: одного названия токена недостаточно." },
      { title: "Нужно выпускать, майнить или покупать NFT?", text: "Нет. Money Nerds — площадка прямой поддержки. Она не выпускает и не майнит NFT, не продаёт коллекционные предметы и не требует покупать NFT для поддержки человека." },
      { title: "Нужна минимальная аудитория? Выплата гарантирована?", text: "Публиковать можно и без готовой аудитории, но публикация не гарантирует взносов. Общей выплаты из фонда платформы нет: поддержка поступает напрямую на выбранный адрес получателя." },
    ],
    resourcesTitle: "Изучите подробности и познакомьтесь с людьми.",
    resourcesIntroduction: "Начните с практической инструкции, прочитайте о комиссиях и безопасности или обратитесь в Money Nerds с вопросом о сервисе.",
    resources: { how: "Пошаговая инструкция", transparency: "Комиссии и прозрачность", safety: "Безопасность и приватность", community: "Как написать и распространить просьбу", faq: "Все частые вопросы", terms: "Условия использования", contact: "Связь и обращения" },
  },
  vi: {
    label: "Gọi vốn cộng đồng bằng tiền mã hóa",
    metadataTitle: "Gọi vốn bằng tiền mã hóa cho cá nhân, meme và sáng tạo",
    metadataDescription: "Hỗ trợ meme, dự án sáng tạo và nhu cầu cá nhân trực tiếp bằng tiền mã hóa trên Money Nerds. Phí nền tảng 0%; vẫn có thể phát sinh phí mạng.",
    title: "Gọi vốn cộng đồng bằng tiền mã hóa, từ người này đến người khác.",
    introduction: "Money Nerds là bảng tin gọi vốn cộng đồng công khai bằng tiền mã hóa dành cho meme, tác phẩm sáng tạo, dự án và nhu cầu cá nhân. Mọi người đăng lời kêu gọi, chọn loại tiền chấp nhận và nhận hỗ trợ tự nguyện trực tiếp tại địa chỉ của mình. Money Nerds không thu hoa hồng nền tảng và không giữ tiền của người dùng; phí mạng và dịch vụ chuyển tiền vẫn có thể phát sinh.",
    breadcrumbLabel: "Đường dẫn điều hướng",
    browseLabel: "Khám phá lời kêu gọi",
    howLabel: "Cách đăng bài hoặc hỗ trợ một người",
    factsLabel: "Cách thức hỗ trợ",
    facts: [
      { title: "Hoa hồng nền tảng 0%", text: "Money Nerds không thu phần trăm từ khoản đóng góp giữa người dùng. Hãy kiểm tra phí mạng và dịch vụ chuyển tiền trước khi xác nhận." },
      { title: "Trực tiếp đến người nhận", text: "Khoản hỗ trợ đến địa chỉ hiển thị cho lời kêu gọi. Không có số dư Money Nerds để rút tiền." },
      { title: "Đọc trước khi đăng nhập", text: "Trước tiên, hãy xem bài viết, thảo luận và hồ sơ công khai. Đăng nhập khi bạn muốn tham gia." },
    ],
    usesTitle: "Nơi dành cho một ý tưởng nhỏ hay nhu cầu thực tế.",
    usesIntroduction: "Chọn danh mục phù hợp nhất, giải thích khoản hỗ trợ sẽ chi cho việc gì và để người đọc quyết định. Đây là ví dụ về lời kêu gọi phù hợp, không phải lời hứa được tài trợ.",
    uses: [
      { category: "memes", title: "Meme", text: "Chia sẻ nội dung hài hước trên mạng hoặc ý tưởng vui của chính bạn. Mọi người có thể hỗ trợ tác giả mà không cần mua vật phẩm sưu tầm." },
      { category: "art", title: "Nghệ thuật và sáng tạo", text: "Giới thiệu tranh, bài hát, bài viết hoặc tác phẩm đang thực hiện và giải thích bước tiếp theo mà hỗ trợ có thể giúp bạn hoàn thành." },
      { category: "build", title: "Dự án và thử nghiệm", text: "Mô tả nguyên mẫu, đóng góp mã nguồn mở hoặc dự án nhỏ, bao gồm những gì đã hoàn thành và những gì còn phải làm." },
      { category: "mutual-aid", title: "Tương trợ", text: "Giải thích rõ nhu cầu cá nhân hoặc cộng đồng. Chỉ chia sẻ thông tin mà bạn được phép công khai." },
      { category: "animals", title: "Hỗ trợ động vật", text: "Giải thích nhu cầu cứu hộ, thức ăn, nơi ở hoặc chăm sóc thú y và cách bạn dự định sử dụng khoản hỗ trợ." },
      { category: "crowdfunding", title: "Gọi vốn cộng đồng", text: "Tập hợp các khoản đóng góp tự nguyện cho dự án hoặc mục tiêu cá nhân và trao đổi về tiến độ trong phần bình luận." },
    ],
    networksTitle: "Chọn tài sản và đúng mạng của tài sản đó.",
    networksIntroduction: "Money Nerds hỗ trợ các mạng chính dưới đây. Mỗi bài viết chỉ cung cấp địa chỉ nhận do tác giả chọn; người hỗ trợ chọn trong các phương án đó.",
    networkColumn: "Mạng",
    assetsColumn: "Tài sản được hỗ trợ",
    networkNote: "USDT trên Ethereum, TRON và Solana là các phương án chuyển khác nhau. Money Nerds không đổi tài sản hoặc chuyển tài sản giữa các mạng. Ví gửi phải khớp cả tài sản lẫn mạng đã chọn.",
    stepsTitle: "Từ lời kêu gọi công khai đến hỗ trợ trực tiếp.",
    steps: [
      { title: "Đăng lời kêu gọi rõ ràng", text: "Đăng nhập bằng phương thức có sẵn, chọn danh mục rồi thêm biệt danh, văn bản hoặc nội dung đa phương tiện. Chọn tài sản chấp nhận và địa chỉ nhận. Đăng nhập không tạo ví tiền mã hóa." },
      { title: "Chia sẻ bài viết và trao đổi", text: "Mỗi bài viết có liên kết công khai riêng. Người đọc có thể xem lời kêu gọi, kiểm tra hồ sơ và đặt câu hỏi trước khi quyết định giúp đỡ." },
      { title: "Chọn phương án và phê duyệt giao dịch", text: "Người hỗ trợ đăng nhập, mở mục Hỗ trợ, chọn một tài sản được chấp nhận và kiểm tra địa chỉ, số tiền, phí trong ví hoặc ứng dụng gửi tương thích. Khả năng hỗ trợ tùy thuộc ví và thiết bị." },
      { title: "Kiểm tra giao dịch", text: "Với giao dịch thủ công, hãy quay lại với mã giao dịch để xác minh. Đang chờ không có nghĩa là đã xác minh: hãy xem trình khám phá blockchain và thử xác minh lại thay vì gửi thêm lần nữa." },
    ],
    boundariesTitle: "Hiểu rõ hỗ trợ trực tiếp mang lại điều gì và có giới hạn nào.",
    boundaries: [
      "Money Nerds cung cấp lời kêu gọi và thảo luận công khai, không giữ tiền ký quỹ hoặc xử lý chiến dịch theo nguyên tắc được tất cả hoặc không nhận gì. Khoản đóng góp không mua cổ phần và không hứa hẹn lợi nhuận tài chính. Money Nerds không thể đảo ngược giao dịch blockchain đã được xác nhận.",
      "Khoản đóng góp đã xác minh ghi nhận một giao dịch trên chuỗi khớp với yêu cầu. Điều đó không xác minh câu chuyện của tác giả, tư cách tổ chức từ thiện, quyền sở hữu địa chỉ tự khai báo hoặc cách tiền được sử dụng sau này. Không có bảo đảm về tài trợ hay kết quả dự án.",
      "Hướng dẫn chuyển khoản ngân hàng SBP thử nghiệm là tính năng riêng, mặc định tắt. Cả hai bên phải bật tính năng này trước khi thông tin nhận tiền được hiển thị. Money Nerds không thể xác nhận chuyển khoản ngân hàng hoặc cộng chúng vào tổng tiền mã hóa đã xác minh.",
    ],
    faqTitle: "Những câu hỏi trước khi chọn nền tảng.",
    questions: [
      { title: "Meme hoặc bình luận có thể nhận hỗ trợ không?", text: "Có. Meme và các lời kêu gọi công khai khác có thể cung cấp phương án nhận hỗ trợ. Bình luận cũng có thể được hỗ trợ khi người viết có phương án nhận tiền. Hãy kiểm tra địa chỉ của ai đang hiển thị trong hộp thoại hỗ trợ." },
      { title: "Tôi có thể nhận đóng góp bằng USDT không?", text: "Có, qua phương án Solana, Ethereum (ERC-20) hoặc TRON (TRC-20) được hỗ trợ mà bạn thêm vào bài viết. Hãy đăng địa chỉ đúng mạng bạn chấp nhận; chỉ tên token là chưa đủ." },
      { title: "Tôi có cần đúc, đào hoặc mua NFT không?", text: "Không. Money Nerds là bảng tin hỗ trợ trực tiếp. Nền tảng không đúc hay đào NFT, không bán vật phẩm sưu tầm và không yêu cầu mua NFT để hỗ trợ một người." },
      { title: "Có cần lượng người theo dõi tối thiểu hoặc có khoản chi trả bảo đảm không?", text: "Bạn có thể đăng bài khi chưa có sẵn người theo dõi, nhưng đăng bài không bảo đảm có đóng góp. Không có khoản chi trả từ quỹ chung của nền tảng: hỗ trợ đến trực tiếp địa chỉ người nhận đã chọn." },
    ],
    resourcesTitle: "Tìm hiểu chi tiết, rồi gặp gỡ mọi người.",
    resourcesIntroduction: "Bắt đầu với hướng dẫn thực hành, xem thông tin về phí và an toàn, hoặc liên hệ Money Nerds nếu có câu hỏi về dịch vụ.",
    resources: { how: "Hướng dẫn từng bước", transparency: "Phí và minh bạch", safety: "An toàn và quyền riêng tư", community: "Viết và chia sẻ lời kêu gọi", faq: "Tất cả câu hỏi thường gặp", terms: "Điều khoản sử dụng", contact: "Liên hệ và báo cáo" },
  },
};

export function getCryptoCrowdfundingContent(locale: Locale): CryptoCrowdfundingContent {
  return CONTENT[locale];
}
