import type { Locale, Messages } from "./config";

// Reviewed interface copy overrides the initial translation draft.
const rows: Array<[string, string, string, string, string]> = [
  ["The new contact address is not active yet. This page cannot submit or send reports.", "La nueva dirección de contacto aún no está activa. Esta página no puede presentar ni enviar informes.", "新的联系邮箱尚未启用，此页面暂时无法提交或发送举报。", "Новая контактная почта ещё не активна. Эта страница пока не может отправлять обращения.", "Địa chỉ liên hệ mới chưa hoạt động. Trang này chưa thể gửi yêu cầu hoặc báo cáo."],
  ["Contact email is being set up. Please do not send messages yet.", "Estamos configurando el correo de contacto. Por favor, no envíes mensajes todavía.", "联系邮箱正在设置中，请暂时不要发送邮件。", "Контактная почта ещё настраивается. Пожалуйста, пока не отправляйте письма.", "Email liên hệ đang được thiết lập. Vui lòng chưa gửi thư."],
  ["Playback speed", "Velocidad de reproducción", "播放速度", "Скорость воспроизведения", "Tốc độ phát"],
  ["Video volume", "Volumen del vídeo", "视频音量", "Громкость видео", "Âm lượng video"],
  ["Use your device volume buttons in this browser.", "Usa los botones de volumen de tu dispositivo en este navegador.", "请在此浏览器中使用设备的音量按钮。", "В этом браузере используйте кнопки громкости устройства.", "Trong trình duyệt này, hãy dùng nút âm lượng trên thiết bị."],
  ["Preparing attachments…", "Preparando archivos adjuntos…", "正在处理附件…", "Подготовка вложений…", "Đang chuẩn bị tệp đính kèm…"],
  ["Compressed locally for faster uploads", "Comprimido en tu dispositivo para subir más rápido", "已在设备上压缩以加快上传", "Сжато на устройстве для быстрой загрузки", "Đã nén trên thiết bị để tải lên nhanh hơn"],
  ["Digital Services Act", "Ley de Servicios Digitales", "数字服务法", "Закон о цифровых услугах", "Đạo luật Dịch vụ Kỹ thuật số"],
  ["Apply", "Aplicar", "应用", "Применить", "Áp dụng"],
  ["We never skim user-to-user funding. Service funding routes and verified transfers stay public.", "No descontamos comisión del apoyo entre usuarios. Las rutas de apoyo al servicio y las transferencias verificadas son públicas.", "我们不从用户之间的资助中抽成。平台收款方式和已核实转账保持公开。", "Мы не удерживаем комиссию с переводов между участниками. Реквизиты поддержки сервиса и подтверждённые переводы открыты.", "Chúng tôi không trích phí từ khoản ủng hộ giữa người dùng. Các địa chỉ nhận tiền của dịch vụ và giao dịch đã xác minh được công khai."],
  ["The public board", "El tablón público", "公共看板", "Публичная лента", "Bảng tin công khai"],
  ["Requests from public profiles", "Peticiones de perfiles públicos", "公开个人资料的求助", "Просьбы участников", "Lời kêu gọi từ hồ sơ công khai"],
  ["Page {page} of {pages} · {count} posts", "Página {page} de {pages} · {count} publicaciones", "第 {page} 页，共 {pages} 页 · {count} 个帖子", "Страница {page} из {pages} · Публикаций: {count}", "Trang {page}/{pages} · {count} bài viết"],
  ["Latest", "Más recientes", "最新", "Новые", "Mới nhất"],
  ["Most loved", "Más me gusta", "最多赞", "Больше лайков", "Nhiều lượt thích nhất"],
  ["Most funded", "Más apoyo", "最多资助", "Больше поддержки", "Được ủng hộ nhiều nhất"],
  ["Posts", "Publicaciones", "帖子", "Публикации", "Bài viết"],
  ["Open ledger", "Registro público", "公开账本", "Открытый реестр", "Sổ giao dịch công khai"],
  ["Public pulse", "Actividad de la comunidad", "社区动态", "Активность сообщества", "Hoạt động cộng đồng"],
  ["Fun", "Diversión", "趣味", "Развлечения", "Vui vẻ"],
  ["Build", "Proyectos", "建设", "Проекты", "Xây dựng"],
  ["Mutual Aid", "Ayuda mutua", "互助", "Взаимопомощь", "Tương trợ"],
  ["Drag around the edge, or use arrow keys to seek five seconds.", "Arrastra por el borde o usa las flechas para avanzar o retroceder cinco segundos.", "沿圆形边缘拖动，或使用方向键跳转五秒。", "Тяните по краю или используйте стрелки для перемотки на пять секунд.", "Kéo dọc mép vòng tròn hoặc dùng phím mũi tên để tua năm giây."],
  ["Privacy choices", "Opciones de privacidad", "隐私选项", "Настройки приватности", "Tùy chọn quyền riêng tư"],
];
export const reviewedMessages = Object.fromEntries((["en", "es", "zh", "ru", "vi"] as Locale[]).map((locale, i) => [locale, Object.fromEntries(rows.map(row => [row[0], row[i]]))])) as Record<Locale, Messages>;
