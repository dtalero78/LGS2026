/**
 * Estilos de los New Books v2 (BEGINNER / PRACTICAL / FUNCTIONAL) — port del
 * prototipo entregado con los libros (book.css), con todos los selectores bajo
 * `.b2`. Incluye el bloque final "LGS original level palettes" del prototipo:
 * --paper y --secondary llegan por nivel desde el catálogo (estilo en línea).
 */
export const BOOK_V2_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;600;700;800&display=swap');
.b2{--accent:#1263cc;--ink:#173b68;--muted:#5b6e85;--cream:var(--paper,#fff9e4);--lime:var(--secondary,#f9e58d);--line:#d7e1ed;background:var(--cream);color:var(--ink);font-family:'DM Sans',Arial,sans-serif;min-height:100vh}
.b2 *{box-sizing:border-box}
.b2 button,.b2 input,.b2 textarea,.b2 select{font:inherit}
.b2 button{cursor:pointer;border:0;background:var(--accent);color:#fff;padding:12px 19px;border-radius:9px;font-weight:700}
.b2 button:hover{filter:brightness(.94)}
.b2 button:disabled{opacity:.5;cursor:default}
.b2 a{color:inherit;text-decoration:none}
.b2 a:focus-visible,.b2 button:focus-visible,.b2 input:focus-visible,.b2 textarea:focus-visible,.b2 select:focus-visible{outline:3px solid #c47c25;outline-offset:4px}
.b2 header.b2-top{background:#fff;display:flex;justify-content:space-between;align-items:center;padding:20px 5%;gap:25px;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:8}
.b2 .brand{display:flex;gap:13px;align-items:center;letter-spacing:.09em;font-weight:800;color:#1263cc}
.b2 .brand img{width:61px;height:43px;object-fit:contain}
.b2 .brand small{display:block;font-size:8px;margin-top:5px;font-weight:500;letter-spacing:.13em}
.b2 nav{display:flex;gap:22px;align-items:center;font-size:13px;font-weight:600;flex-wrap:wrap}
.b2 nav a.on{color:var(--accent)}
.b2 .quiet{background:var(--secondary);color:var(--ink);padding:9px 12px}
.b2 .notice{font-size:11px;text-align:center;padding:10px 20px;background:var(--secondary);color:#173b68;line-height:1.6}
.b2 main{min-height:70vh;max-width:1400px;margin:auto;padding:48px 5% 75px}
.b2 .eyebrow{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0 0 1em}
.b2 h1,.b2 h2,.b2 h3{font-family:Manrope,Arial,sans-serif;letter-spacing:-.04em}
.b2 h1{font-size:clamp(38px,5vw,70px);line-height:1.06;margin:20px 0 23px;font-weight:800}
.b2 h2{font-size:32px;line-height:1.15;margin:12px 0 18px;font-weight:700}
.b2 h3{font-size:20px;margin:12px 0;line-height:1.25;font-weight:700}
.b2 p{line-height:1.75;margin:0 0 1em}
.b2 .muted{color:var(--muted)}
.b2 .hero{display:grid;grid-template-columns:1.05fr 1fr;gap:55px;align-items:center;padding:20px 0 55px}
.b2 .hero .intro{max-width:470px;color:var(--muted);font-size:17px}
.b2 .actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:24px 0}
.b2 .button{display:inline-block;background:var(--accent);color:#fff;border-radius:9px;padding:14px 20px;font-weight:700;font-size:14px}
.b2 .secondary{background:transparent;color:var(--ink);border:1px solid var(--line)}
.b2 .heroArt{background:var(--secondary);border:2px solid #3186ee;border-radius:46% 46% 18px 18px;min-height:440px;padding:45px 28px 26px;position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:15px;align-content:center;transform:rotate(1deg)}
.b2 .heroArt figure{margin:0;text-align:center;background:#fff;padding:13px 7px;border-radius:15px;box-shadow:0 8px 20px #1e3e3910;transform:rotate(-3deg)}
.b2 .heroArt figure:nth-child(2n){transform:rotate(3deg) translateY(15px)}
.b2 .heroArt img{width:100%;height:110px;object-fit:contain}
.b2 .heroArt figcaption{font-size:11px;font-weight:700}
.b2 .heroArt .sticker{position:absolute;right:-12px;top:13px;border-radius:50%;background:var(--lime);width:100px;height:100px;display:grid;place-content:center;text-align:center;font-size:12px;line-height:1.6;transform:rotate(12deg)}
.b2 .stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:16px 0 46px;padding:25px 0}
.b2 .stats>div{padding:0 25px;border-right:1px solid var(--line)}
.b2 .stats>div:last-child{border:0}
.b2 .stats strong{font:800 26px Manrope,Arial}
.b2 .stats span{display:block;font-size:12px;color:var(--muted);margin-top:7px}
.b2 .sectionHead{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:22px 0}
.b2 .sectionHead h2{margin-bottom:0}
.b2 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.b2 .card{display:block;background:#fff;border:1px solid var(--line);border-radius:15px;padding:23px;position:relative;transition:transform .2s}
.b2 .card:hover{transform:translateY(-3px)}
.b2 .cardTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
.b2 .card img{width:66px;height:66px;object-fit:contain;background:var(--secondary);border-radius:50%}
.b2 .tag{font-size:10px;font-weight:800;letter-spacing:.08em;background:var(--secondary);padding:7px 10px;border-radius:20px}
.b2 .card p{font-size:13px;color:var(--muted);min-height:44px}
.b2 .card .go{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:14px;font-size:12px;font-weight:700}
.b2 .bar{height:6px;background:#dce8f6;border-radius:10px;overflow:hidden}
.b2 .bar i{display:block;height:100%;background:var(--accent)}
.b2 .banner{background:#1263cc;color:#fff;padding:32px;border-radius:18px;margin-top:35px;display:flex;justify-content:space-between;gap:20px;align-items:center}
.b2 .banner p{margin:0;color:#d6e2d4}
.b2 .banner .secondary{color:#fff;border-color:#ffffff80}
.b2 .breadcrumb{font-size:12px;color:var(--muted);margin-bottom:22px}
.b2 .unitHead{display:flex;justify-content:space-between;gap:30px;align-items:center}
.b2 .unitHead h1{font-size:42px;margin:10px 0}
.b2 .unitHead img{width:110px;height:110px;object-fit:contain}
.b2 .tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:30px 0;padding-bottom:14px}
.b2 .tabs button{background:transparent;color:var(--muted);font-size:13px}
.b2 .tabs button.active{background:var(--accent);color:#fff}
.b2 .panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:32px;max-width:1000px;margin:auto}
.b2 .dialogLine{display:flex;gap:16px;border-bottom:1px solid #eef0e9;padding:18px 0}
.b2 .dialogLine img{width:55px;height:55px;object-fit:contain;background:var(--secondary);border-radius:50%;flex-shrink:0}
.b2 .dialogLine b{font-size:11px;letter-spacing:.08em;color:var(--accent)}
.b2 .dialogLine p{margin:7px 0;font-size:17px}
.b2 .reading{font-size:18px;line-height:1.95;max-width:760px;margin:25px auto;white-space:pre-line}
.b2 .focus{background:var(--secondary);padding:20px;border-radius:10px;margin-top:25px;font-size:14px}
.b2 .question{border:0;padding:20px 0;border-bottom:1px solid var(--line);margin:0 0 14px}
.b2 .question legend{font-weight:700;font-size:16px;line-height:1.6}
.b2 .option{display:flex;gap:12px;border:1px solid var(--line);padding:13px 15px;border-radius:9px;margin:9px 0;cursor:pointer;font-size:14px}
.b2 .option:has(input:checked){border-color:var(--accent);background:var(--paper)}
.b2 .option input{accent-color:var(--accent)}
.b2 .result{padding:20px;background:#e8f1d8;border-radius:12px;margin:20px 0}
.b2 .result.fail{background:#fff0df}
.b2 .task{padding:25px 0;border-bottom:1px solid var(--line)}
.b2 .task p{font-size:13px;white-space:pre-line}
.b2 label{display:block;font-size:14px;margin:12px 0 6px}
.b2 textarea{width:100%;min-height:145px;padding:13px;border:1px solid #bac8ba;border-radius:10px;resize:vertical;line-height:1.7;background:#fff;color:var(--ink)}
.b2 .task small{display:block;color:var(--muted);margin:10px 0}
.b2 .viewerControls{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin:20px 0}
.b2 .viewerControls input{width:75px;padding:10px;border:1px solid var(--line);border-radius:8px}
.b2 .viewer{background:#dce8f6;border-radius:14px;padding:20px;text-align:center;overflow:auto;max-height:80vh}
.b2 .viewer img{width:min(100%,780px);height:auto;box-shadow:0 10px 30px #0002;display:block;margin:auto;user-select:none}
.b2 .viewer.zoom img{width:1100px;max-width:none}
.b2 .tableWrap{overflow-x:auto}
.b2 table{border-collapse:collapse;width:100%;font-size:13px}
.b2 th,.b2 td{text-align:left;padding:15px 12px;border-bottom:1px solid var(--line)}
.b2 th{font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.b2 .passed{color:#347443;font-weight:700}
.b2 .loading{padding:60px;text-align:center}
.b2 .pill{display:inline-block;border:1px solid var(--line);padding:7px 12px;border-radius:30px;font-size:12px;margin:4px}
.b2 .empty{color:var(--muted);padding:30px;text-align:center}
.b2 select{padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff;max-width:100%}
.b2 footer.b2-foot{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:30px 5%;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
.b2 .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#18372f;color:#fff;padding:14px 22px;border-radius:12px;z-index:50;max-width:90%;box-shadow:0 8px 30px #0002}
.b2 .modal-bg{position:fixed;inset:0;background:#18372f77;z-index:40;display:flex;align-items:center;justify-content:center;padding:15px}
.b2 .modal{max-width:500px;width:90%;border:1px solid var(--line);border-radius:18px;padding:32px;color:var(--ink);background:#fff}
.b2 .modal label,.b2 .modal select,.b2 .modal input{display:block;width:100%;margin:16px 0}
.b2 .close{float:right;background:#eef0e6;color:var(--ink)}
.b2 .preview{background:#e8f1fb;border-bottom:1px solid #b7d3f0;color:#1d4e7a;padding:10px 20px;font-size:13px;text-align:center}
@media(max-width:850px){.b2 header.b2-top{position:relative;flex-direction:column;align-items:flex-start;padding:18px 5%}.b2 nav{gap:16px;flex-wrap:wrap}.b2 .hero{gap:25px}.b2 .heroArt{min-height:350px;padding:25px 15px}.b2 .heroArt img{height:85px}.b2 .grid{grid-template-columns:repeat(2,1fr)}.b2 main{padding-top:28px}}
@media(max-width:600px){.b2 .hero{grid-template-columns:1fr}.b2 .heroArt{max-width:430px;min-height:330px;margin:15px 8px}.b2 .heroArt img{height:90px}.b2 h1{font-size:44px}.b2 .stats>div{padding:0 12px}.b2 .stats strong{font-size:22px}.b2 .grid{grid-template-columns:1fr}.b2 .panel{padding:20px}.b2 .unitHead h1{font-size:32px}.b2 .unitHead img{width:70px;height:70px}.b2 .banner{flex-direction:column;align-items:flex-start}.b2 .sectionHead{align-items:flex-start;flex-direction:column}.b2 .viewer{padding:5px}.b2 .tabs{gap:2px}.b2 .tabs button{padding:10px;font-size:12px}.b2 .reading{font-size:16px}.b2 .dialogLine p{font-size:15px}.b2 .dialogLine img{width:40px;height:40px}}
`;
