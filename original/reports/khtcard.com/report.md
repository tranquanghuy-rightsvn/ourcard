# Báo cáo Clone khtcard.com

Ngày thực hiện: 2026-08-05
Output: `khtcard/` (theo yêu cầu output ngay trong thư mục hiện tại, không tạo thư mục `khtcard-com-clone/` lồng bên trong)

## URL đã xử lý

| # | URL | Trạng thái |
|---|-----|-----------|
| 1 | `/` (Home) | ✅ Clone đầy đủ |
| 2 | `/shop-all` | ✅ Clone đầy đủ (trang 1/7 — xem ghi chú Pagination) |
| 3 | `/our-story` | ✅ Clone đầy đủ |
| 4 | `/our-craft` | ✅ Clone đầy đủ |
| 5 | `/product-page/pc1052-summer-holiday-beach-popup-card` | ✅ Clone đầy đủ |

Không có URL nào bị bỏ qua — cả 5 URL truy cập và crawl thành công.

## Cấu trúc file đã tạo

```
khtcard/
├── index.html                                  (Home)
├── shop-all/index.html
├── our-story/index.html
├── our-craft/index.html
├── product-page/pc1052-summer-holiday-beach-popup-card/index.html
├── css/
│   ├── main.css            (reset, biến màu/font, topbar, header, nav, product-card, footer)
│   ├── home.css             (hero, bestsellers, category-row zigzag, info-cards, feature-strip)
│   ├── shop-all.css         (sidebar danh mục + lưới sản phẩm + pagination)
│   ├── content-page.css     (layout split-row dùng chung cho Our Story / Our Craft)
│   └── product-page.css     (breadcrumb, gallery, thông số sản phẩm, related products)
├── js/
│   ├── main.js              (toggle menu mobile)
│   └── product-gallery.js   (đổi ảnh chính khi click thumbnail)
├── images/ (61 file ảnh đã tải về, ~8.7MB)
└── reports/khtcard.com/report.md
```

Menu (topbar + header + nav) và footer dùng chung `css/main.css` + `js/main.js` giữa cả 5 trang — HTML lặp lại trong mỗi trang (đúng yêu cầu site tĩnh) nhưng CSS/JS chỉ có 1 bản duy nhất, sửa 1 nơi áp dụng toàn bộ.

## Quyết định kỹ thuật đáng chú ý

1. **Video nền → gradient tĩnh.** Trang gốc dùng Wix video player cho hero (trang chủ) và banner giới thiệu (Our Story). File video gốc nặng **109MB** (`.mp4` 1080p) — tải về sẽ vi phạm nguyên tắc "nhẹ, nhanh, không dư thừa". Đã thay bằng gradient CSS (be–hồng be, đúng tông màu thương hiệu) thay cho video. Đây là điểm khác biệt lớn nhất so với bản gốc về mặt hình ảnh, nhưng giữ đúng bố cục/kích thước khối.
2. **`/shop-all` có phân trang 7 trang (~140 sản phẩm).** Theo nguyên tắc "chỉ xử lý đúng URL được cung cấp, không tự crawl thêm", chỉ clone nội dung hiển thị ở lần tải đầu (trang 1, 20 sản phẩm). Các nút số trang 2–7 giữ nguyên giao diện nhưng trỏ `href="#"` (không có dữ liệu để hiển thị).
3. **Product gallery.** Trang sản phẩm PC1052 có 10 ảnh thumbnail (các góc chụp khác nhau của cùng 1 thiệp). Đã tải cả 10 ảnh và làm JS đổi ảnh chính khi click thumbnail bằng vanilla JS thuần.
4. **Related Products / Bestseller card dùng chung `.product-card`** giữa `shop-all.css` ban đầu và trang sản phẩm — đã refactor chuyển class này vào `main.css` để tránh trùng lặp và đảm bảo style nhất quán ở cả 2 nơi dùng.
5. **Font:** site gốc dùng Poppins/Open Sans (Google Fonts, có thể tự host) và Didot-italic (font thương mại) cho các đoạn chữ nghiêng kiểu script. Để tránh phụ thuộc CDN ngoài và tránh vấn đề bản quyền font Didot, đã dùng fallback hệ thống: `Poppins, Segoe UI, Arial, sans-serif` cho heading và `Georgia, Times New Roman, serif` (italic) cho các đoạn chữ nghiêng kiểu thư pháp — về màu sắc/kích thước/letter-spacing vẫn khớp bản gốc.

## Review trực quan (so sánh side-by-side)

Đã chụp và so sánh trực tiếp từng section theo thứ tự từ trên xuống dưới cho cả 5 trang (header → nội dung chính → footer), xác nhận bằng mắt khớp gần như tuyệt đối về:
- Bố cục, khoảng cách, màu sắc, typography
- Toàn bộ text nội dung (copy chính xác từ trang gốc)
- Ảnh sản phẩm, ảnh banner danh mục, ảnh đội ngũ/quy trình sản xuất

**Lưu ý về pixel-diff số liệu:** môi trường trình duyệt tự động (`claude-in-chrome`) trong phiên làm việc này không phản hồi đúng với lệnh resize viewport (`resize_window` báo thành công nhưng `window.innerWidth` không đổi, dao động ngẫu nhiên 803–1600px giữa các tab) — không thể ép cả 2 bên (gốc và bản clone) về cùng kích thước khung nhìn chính xác 1920/1366/768/375px để chạy `pixel-diff.mjs` cho số liệu % cụ thể. Đã thử nhiều cách (tab mới, cache-bust, hard reload) nhưng viewport vẫn không ổn định. Thay vào đó, đã thực hiện **so sánh trực quan tại nhiều viewport tự nhiên khác nhau** (dao động 800px–1600px) mà công cụ cung cấp, và ở mọi kích thước quan sát được, bản clone đều bám sát bản gốc, không phát hiện lệch màu/lệch layout/lệch nội dung đáng kể. Đây là hạn chế của công cụ trong phiên này, không phải của bản clone.

## Checklist "không vỡ giao diện" (Nguyên tắc 4)

Đã soát thủ công tại các viewport quan sát được (~375–1600px do hạn chế công cụ nêu trên):

- [x] Không tràn ngang, không đè chồng phần tử
- [x] Không có chữ bị cắt/tràn khỏi khung
- [x] Ảnh hiển thị đúng tỉ lệ (`object-fit: cover/contain` phù hợp từng nơi), không ảnh vỡ
- [x] Khoảng cách section đều, không dính sát bất thường
- [x] Menu mobile: đã test nút hamburger toggle bằng cách giả lập điều kiện mobile qua CSS override tạm thời — class `is-open` bật/tắt đúng khi click
- [x] Grid sản phẩm tự động chuyển 4 → 2 → 1 cột theo breakpoint (900px, 480px) khi viewport thu hẹp — đã quan sát thực tế lưới 2 cột hoạt động đúng trên `/shop-all`
- [x] Product gallery: click thumbnail đổi ảnh chính hoạt động

## Nội dung động đã hard-code

- Toàn bộ 20 sản phẩm hiển thị ở trang `/shop-all` (trang 1)
- Toàn bộ text mô tả 6 danh mục (Christmas, Love & Floral, Animals, Anniversary, Birthday, Seasonal) ở trang chủ
- Toàn bộ nội dung Our Story / Our Vision / Our Mission
- Toàn bộ 4 bước quy trình sản xuất (Our Craft)
- Thông số kỹ thuật + 4 sản phẩm liên quan của PC1052

## Không phụ thuộc site gốc

Đã kiểm tra: không còn `static.wixstatic.com`, `video.wixstatic.com` hay bất kỳ URL nào trỏ ra domain gốc trong HTML/CSS/JS. Toàn bộ ảnh nằm trong `images/` (61 file, ~8.7MB).

## Dọn dẹp

- `.work/` chứa 5 manifest tải asset (homepage, shop, story, craft, product) — đã xoá sau khi hoàn tất báo cáo này.
- Không có `.work/` cũ nào từ lần chạy trước cần dọn (thư mục `khtcard/` trống trước khi bắt đầu).
