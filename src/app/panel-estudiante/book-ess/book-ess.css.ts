/**
 * Estilos del Book ESS New — port del prototipo entregado con el libro
 * (Books/LGS_ESSENTIAL_integracion_v1/reference-html/style.css), con TODOS los
 * selectores bajo `.bk` para no chocar con Tailwind ni con el resto del panel.
 */
export const BOOK_ESS_CSS = `
.bk{--ink:#202e29;--green:#253f34;--lime:#d8eb90;--purple:#6d519b;--paper:#f7f8f2;--line:#dde3d7;--muted:#667467;background:var(--paper);color:var(--ink);font:16px/1.6 Arial,sans-serif;min-height:100vh}
.bk *{box-sizing:border-box}
.bk a{color:inherit}
.bk button,.bk input,.bk textarea,.bk select{font:inherit}
.bk button{cursor:pointer;border:0;border-radius:9px;padding:12px 19px;background:var(--green);color:#fff;font-weight:600}
.bk button:hover{filter:brightness(1.12)}
.bk button:disabled{opacity:.5;cursor:default;filter:none}
.bk a:focus-visible,.bk button:focus-visible,.bk input:focus-visible,.bk textarea:focus-visible,.bk select:focus-visible,.bk summary:focus-visible{outline:3px solid #a26bdd;outline-offset:4px}
.bk header.bk-top{background:#fffffff2;backdrop-filter:blur(10px);padding:18px 5vw;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;border-bottom:1px solid var(--line);gap:16px}
.bk .brand{display:flex;align-items:center;gap:16px;text-decoration:none;font-weight:800;letter-spacing:2px;font-size:17px}
.bk .brand img{width:84px;height:48px;object-fit:contain}
.bk .brand span{border-left:1px solid var(--line);padding-left:16px}
.bk .brand small{display:block;font-size:8px;letter-spacing:2px;color:var(--muted)}
.bk nav{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.bk nav a{text-decoration:none;font-size:14px}
.bk nav a:hover,.bk nav a.on{color:var(--purple)}
.bk nav button{background:#f0f3e7;color:var(--green);padding:8px 15px}
.bk main{max-width:1320px;margin:auto;padding:36px 5vw 70px}
.bk h1,.bk h2,.bk h3,.bk p{margin-top:0}
.bk p{margin-bottom:1em}
.bk h1{margin-bottom:.67em}
.bk h2{margin-bottom:.83em}
.bk h3{margin-bottom:1em}
.bk ul,.bk ol{margin:0 0 1em;padding-left:1.4em}
.bk h1{font-size:clamp(42px,5.8vw,78px);line-height:1.04;letter-spacing:-3px;font-weight:500}
.bk h2{font-size:32px;line-height:1.2;letter-spacing:-1px;font-weight:700}
.bk h3{font-size:20px;line-height:1.3;font-weight:700}
.bk .eyebrow{font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:var(--purple);margin-bottom:18px}
.bk .hero{display:grid;grid-template-columns:1.05fr 1fr;min-height:470px;background:var(--green);color:#fff;border-radius:20px;overflow:hidden}
.bk .hero .copy{padding:48px}
.bk .hero .eyebrow{color:var(--lime)}
.bk .hero h1 em{font-family:Georgia,serif;color:var(--lime);font-weight:400}
.bk .hero p:not(.eyebrow){max-width:380px;color:#d5dfd8;font-size:15px}
.bk .hero-art{position:relative;overflow:hidden;background:#a4c89e}
.bk .hero-art img{width:100%;height:100%;object-fit:cover;object-position:center}
.bk .hero-art:after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,#172a2b80,transparent 50%)}
.bk .hero-tag{position:absolute;bottom:28px;left:28px;right:28px;z-index:1;border-top:1px solid #ffffff70;padding-top:20px;display:flex;justify-content:space-between}
.bk .hero-tag b{font-size:28px}
.bk .primary{background:var(--lime);color:var(--green)}
.bk .secondary{background:#e9edde;color:var(--green)}
.bk .ghost{background:transparent;color:inherit;border:1px solid var(--line)}
.bk .hero .ghost{border-color:#84988b}
.bk .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px;align-items:center}
.bk .stats{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line);padding:26px 0;gap:25px;margin-bottom:38px}
.bk .stats>div{display:flex;gap:15px;align-items:center}
.bk .stats b{font:32px Georgia,serif;color:var(--purple)}
.bk .stats span{font-size:13px;color:var(--muted)}
.bk .section-head{display:flex;justify-content:space-between;align-items:center;margin:28px 0 20px;gap:20px}
.bk .section-head h2{margin-bottom:5px}
.bk .muted{color:var(--muted);font-size:14px}
.bk .unitgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.bk .unitcard{background:#fff;border:1px solid var(--line);border-radius:15px;overflow:hidden;transition:transform .2s;text-decoration:none;display:block}
.bk .unitcard:hover{transform:translateY(-4px)}
.bk .unitcard img,.bk .imgph{width:100%;height:180px;object-fit:cover;display:block;background:#dfe7d6}
.bk .unitbody{padding:22px}
.bk .unitbody h3{margin:10px 0}
.bk .unitbody p{font-size:13px;color:var(--muted);min-height:42px}
.bk .unitmeta{display:flex;justify-content:space-between;font-size:10px;letter-spacing:1px;color:var(--purple);font-weight:700}
.bk .progress{height:5px;border-radius:10px;background:#e6ebde;overflow:hidden}
.bk .progress i{display:block;height:100%;background:var(--purple)}
.bk .cardfoot{display:flex;justify-content:space-between;font-size:12px;padding-top:15px;color:var(--muted)}
.bk .banner{padding:30px;background:#ebe5f5;border-radius:15px;margin:30px 0;display:flex;justify-content:space-between;align-items:center;gap:20px}
.bk .banner h3{margin-bottom:6px}
.bk .banner p{margin-bottom:0}
.bk .breadcrumbs{font-size:12px;color:var(--muted);margin-bottom:20px}
.bk .unit-hero{display:grid;grid-template-columns:1.6fr 1fr;gap:30px;margin-bottom:25px;align-items:center}
.bk .unit-hero img,.bk .unit-hero .imgph{width:100%;height:220px;object-fit:cover;border-radius:14px}
.bk .unit-hero h1{font-size:44px;letter-spacing:-1.8px}
.bk .tabs{display:flex;gap:8px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:30px;flex-wrap:wrap}
.bk .tabs button{background:transparent;color:var(--muted);font-size:14px}
.bk .tabs button.active{background:var(--green);color:#fff}
.bk .lesson-layout{display:grid;grid-template-columns:1fr 280px;gap:28px}
.bk .panel{background:#fff;border:1px solid var(--line);padding:28px;border-radius:14px;margin-bottom:22px}
.bk .note{background:#eef2de;border-left:3px solid #829f3d;padding:20px;border-radius:0 10px 10px 0;margin-bottom:25px}
.bk .words{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;margin-bottom:28px}
.bk .word{text-align:left;background:#fff;color:var(--ink);border:1px solid var(--line);padding:15px;min-height:90px;font-weight:400}
.bk .word b{display:block;font-weight:600}
.bk .word small{display:block;color:var(--muted);font-size:12px;margin-top:5px}
.bk .word:after{content:'↗';float:right;font-size:12px;color:var(--purple)}
.bk .sidebox{background:#ece7f2;border-radius:14px;padding:24px;margin-bottom:18px}
.bk .sidebox h3{font:26px Georgia,serif}
.bk .sidebox p{font-size:14px}
.bk .dialogue{padding:20px 0}
.bk .bubble{max-width:80%;padding:14px 20px;background:#eaf0de;border-radius:14px 14px 14px 0;margin:12px 0}
.bk .bubble:nth-child(even){margin-left:auto;background:#ede6f4;border-radius:14px 14px 0 14px}
.bk .bubble small{display:block;font-size:10px;color:var(--muted);margin-bottom:3px}
.bk .bubble small button{padding:0 8px;min-height:25px;margin-left:6px}
.bk .question{padding:24px;background:#fff;border:1px solid var(--line);border-radius:12px;margin:16px 0}
.bk .options{display:grid;gap:8px}
.bk .option{text-align:left;background:#f1f3ec;color:var(--ink);border:2px solid transparent;font-weight:400}
.bk .option.selected{border-color:var(--purple);background:#ece4f5}
.bk .option.correct{border-color:#2d7c50;background:#e6f3e9}
.bk .option.wrong{border-color:#b15944;background:#fff0e9}
.bk .feedback{font-size:14px;margin:12px 0 0;color:var(--green)}
.bk .feedback.bad{color:#9a4433}
.bk label{display:block;font-size:14px;margin:16px 0 7px}
.bk textarea,.bk input[type=text],.bk select{width:100%;padding:12px;border:1px solid #bec9b8;border-radius:8px;background:#fff;color:var(--ink)}
.bk textarea{min-height:105px;resize:vertical}
.bk .pager{display:flex;justify-content:space-between;gap:15px;margin-top:28px}
.bk .passport{background:var(--green);color:#fff;border-radius:20px;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.bk .passport .eyebrow{color:var(--lime)}
.bk .passport h1{font:52px Georgia,serif;letter-spacing:0}
.bk .stamps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:25px}
.bk .stamp{border:1px dashed #b7c1b2;padding:18px 8px;text-align:center;border-radius:50%;aspect-ratio:1;display:flex;flex-direction:column;justify-content:center;opacity:.55;font-size:11px}
.bk .stamp b{font:30px Georgia,serif}
.bk .stamp.earned{background:var(--lime);border:2px solid var(--green);outline:1px solid var(--green);outline-offset:-7px;color:var(--green);opacity:1}
.bk .route{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.bk .route a{display:block;background:#fff;border:1px solid var(--line);border-top:4px solid var(--purple);padding:25px;border-radius:10px;text-decoration:none}
.bk .route a.done{border-top-color:#7a9842}
.bk .route strong{display:block;font:35px Georgia;color:var(--purple);margin-bottom:14px}
.bk .bookpage{display:block;width:100%;max-width:760px;margin:16px auto;border:1px solid var(--line);background:#fff;user-select:none}
.bk .bookbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.bk details{border:1px solid var(--line);padding:20px;border-radius:10px;margin:18px 0;background:#fff}
.bk summary{cursor:pointer;font-weight:bold}
.bk .table{width:100%;border-collapse:collapse;font-size:14px}
.bk .table td,.bk .table th{padding:14px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.bk .search{max-width:300px;margin:0}
.bk footer.bk-foot{display:flex;justify-content:space-between;padding:25px 5vw;border-top:1px solid var(--line);gap:20px;font-size:11px;color:var(--muted)}
.bk footer.bk-foot b{letter-spacing:2px}
.bk .modal-bg{position:fixed;inset:0;background:#14241dcc;z-index:40;display:flex;align-items:center;justify-content:center;padding:15px}
.bk .modal{max-width:520px;width:100%;border-radius:16px;padding:30px;background:#fff;color:var(--ink)}
.bk .close{float:right;background:none;color:var(--ink);font-size:25px;padding:0 8px}
.bk .toast{position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:12px 22px;border-radius:10px;z-index:50;max-width:90vw}
.bk .score{font:64px Georgia;color:var(--purple)}
.bk .listening{background:#eee8f6;padding:25px;border-radius:12px}
.bk .listening input{max-width:300px}
.bk .pill{display:inline-block;background:#eae6f3;color:var(--purple);font-size:11px;padding:5px 10px;border-radius:20px}
.bk .preview{background:#e8f1fb;border:1px solid #b7d3f0;color:#1d4e7a;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:20px}
.bk .saved{font-size:12px;color:#2d7c50}
@media(max-width:900px){.bk nav{gap:14px}.bk .hero .copy{padding:30px}.bk .hero{min-height:420px}.bk .unitgrid{grid-template-columns:repeat(2,1fr)}.bk .lesson-layout{grid-template-columns:1fr}.bk .lesson-layout aside{display:grid;grid-template-columns:1fr 1fr;gap:15px}.bk .passport{grid-template-columns:1fr}.bk .unit-hero h1{font-size:36px}}
@media(max-width:600px){.bk header.bk-top{position:static;flex-direction:column;gap:18px;padding:15px}.bk nav{width:100%;justify-content:space-between;gap:8px}.bk nav a{font-size:12px}.bk nav button{font-size:12px}.bk main{padding:22px 16px 45px}.bk .hero{grid-template-columns:1fr}.bk .hero .copy{padding:30px}.bk .hero h1{font-size:49px}.bk .hero-art{height:240px}.bk .stats{gap:12px}.bk .stats>div{display:block}.bk .stats b{display:block}.bk .unitgrid{gap:12px}.bk .unitcard img,.bk .unitcard .imgph{height:130px}.bk .unitbody{padding:15px}.bk .unitbody h3{font-size:17px}.bk .unitbody p{min-height:65px}.bk .section-head{align-items:start;flex-direction:column}.bk .banner{align-items:start;flex-direction:column}.bk .unit-hero{grid-template-columns:1fr}.bk .unit-hero img,.bk .unit-hero .imgph{height:180px}.bk .panel{padding:20px}.bk .lesson-layout aside{display:block}.bk .route{grid-template-columns:1fr 1fr}.bk .passport{padding:25px}.bk .stamps{grid-template-columns:repeat(3,1fr)}.bk .table{font-size:12px}.bk .table td,.bk .table th{padding:8px}.bk .tabs{gap:2px}.bk .tabs button{padding:9px 11px;font-size:12px}.bk footer.bk-foot{flex-direction:column;gap:8px}.bk .words{grid-template-columns:1fr 1fr}}
@media print{.bk header.bk-top,.bk footer.bk-foot,.bk .tabs,.bk .actions,.bk .pager,.bk button,.bk .breadcrumbs,.bk .toast,.bk .preview{display:none!important}.bk{background:#fff}.bk main{padding:0;max-width:none}.bk .passport{background:#fff;color:#000;border:2px solid #253f34}.bk .passport .eyebrow{color:#000}.bk .panel,.bk .question{break-inside:avoid}.bk .lesson-layout{display:block}.bk .lesson-layout aside{display:none}.bk .unit-hero img{height:130px}.bk .unit-hero h1{font-size:30px}.bk .words{grid-template-columns:repeat(3,1fr)}.bk .stamp{opacity:1}}
`;
