// ==========================================
// SJTU Canvas 视频下载助手 v2.0
// 解决 403 Forbidden 问题
// 使用方法：复制全部代码 -> F12 -> Console -> 粘贴 -> 回车
// ==========================================

(function() {
    'use strict';
    console.log("正在初始化视频下载脚本 (v2.0)...");

    // 样式注入
    const style = document.createElement('style');
    style.innerHTML = `
        .sjtu-dl-btn {
            display: block; width: 100%; padding: 8px 0; margin-top: 5px;
            background: #1890ff; color: white; border: none; border-radius: 4px;
            cursor: pointer; font-size: 13px; text-align: center; text-decoration: none;
            transition: all 0.2s;
        }
        .sjtu-dl-btn:hover { background: #40a9ff; }
        .sjtu-dl-btn.secondary { background: #555; margin-top: 5px; }
        .sjtu-dl-btn.secondary:hover { background: #777; }
        .sjtu-dl-loading { opacity: 0.7; pointer-events: none; }
    `;
    document.head.appendChild(style);

    // 核心函数：寻找视频地址
    function findVideoUrl() {
        const candidates = new Set();
        // 1. 检查网络资源 (Performance API) - 最可靠
        performance.getEntriesByType('resource').forEach(res => {
            if (res.name.includes('.mp4')) candidates.add(res.name);
        });
        // 2. 检查 HTML5 Video
        document.querySelectorAll('video').forEach(v => {
            if (v.src && !v.src.startsWith('blob:')) candidates.add(v.src);
            v.querySelectorAll('source').forEach(s => { if (s.src) candidates.add(s.src); });
        });
        return Array.from(candidates);
    }

    // 下载核心逻辑：使用 fetch 下载 Blob 并生成本地链接，绕过 Referer 限制
    async function downloadWithBlob(url, btn) {
        const originalText = btn.innerText;
        btn.innerText = "⏳ 正在缓冲(0%)...请勿关闭";
        btn.classList.add('sjtu-dl-loading');

        try {
            console.log("开始下载视频流...");
            const response = await fetch(url, {
                referrerPolicy: 'no-referrer-when-downgrade' // 尝试保留 Referer
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // 读取流以显示进度
            const reader = response.body.getReader();
            const contentLength = +response.headers.get('Content-Length');
            let receivedLength = 0;
            const chunks = [];

            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                if (contentLength) {
                    const progress = Math.round((receivedLength / contentLength) * 100);
                    btn.innerText = `⏳ 缓冲中 (${progress}%)...`;
                }
            }

            console.log("下载完成，正在合并文件...");
            btn.innerText = "正在保存...";
            
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const localUrl = URL.createObjectURL(blob);
            
            // 触发下载
            const a = document.createElement('a');
            a.href = localUrl;
            a.download = `sjtu_video_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(localUrl); // 稍后释放

            btn.innerText = "✅ 下载成功";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('sjtu-dl-loading');
            }, 3000);

        } catch (err) {
            console.error("下载失败:", err);
            btn.innerText = "❌ 直接下载失败";
            alert("直接下载失败 (可能是跨域限制)。\n请尝试下方的【复制终端命令】方式下载。");
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('sjtu-dl-loading');
            }, 3000);
        }
    }

    // 生成 cURL 命令
    function copyCurlCommand(url) {
        // 获取当前页面的 Cookie
        const cookies = document.cookie;
        const referer = window.location.href;
        const userAgent = navigator.userAgent;

        // 构建命令
        const cmd = `curl "${url}" \\
  -H "Referer: ${referer}" \\
  -H "User-Agent: ${userAgent}" \\
  -H "Cookie: ${cookies}" \\
  -o "sjtu_video_${Date.now()}.mp4"`;

        // 复制到剪贴板
        navigator.clipboard.writeText(cmd).then(() => {
            alert("✅ 命令已复制！\n\n请打开电脑的【终端 (Terminal)】或【命令行】，粘贴并回车即可开始下载。");
        }).catch(() => {
            prompt("复制失败，请手动复制以下命令：", cmd);
        });
    }

    // UI 渲染
    function showDownloadUI(urls) {
        const UI_ID = 'sjtu-downloader-ui-v2';
        let container = document.getElementById(UI_ID);

        if (!container) {
            container = document.createElement('div');
            container.id = UI_ID;
            Object.assign(container.style, {
                position: 'fixed', top: '20px', right: '20px', zIndex: '999999',
                backgroundColor: 'rgba(0, 0, 0, 0.9)', color: '#fff', padding: '15px',
                borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                fontFamily: 'sans-serif', width: '300px', maxHeight: '80vh', overflowY: 'auto'
            });
            
            container.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:5px;">
                    <span style="font-weight:bold">🎥 视频下载助手</span>
                    <span id="sjtu-close-btn" style="cursor:pointer;font-size:18px;">✕</span>
                </div>
                <div id="${UI_ID}-list"></div>
            `;
            document.body.appendChild(container);
            document.getElementById('sjtu-close-btn').onclick = () => container.remove();
        }

        const list = document.getElementById(UI_ID + '-list');
        list.innerHTML = '';

        if (urls.length === 0) {
            list.innerHTML = '<div style="color:#aaa;font-size:12px;text-align:center;padding:10px;">⏳ 正在监听网络...<br>请点击播放视频，链接会自动出现</div>';
            return;
        }

        urls.forEach((url, index) => {
            const item = document.createElement('div');
            item.style.marginBottom = '15px';
            item.style.borderBottom = '1px dashed #444';
            item.style.paddingBottom = '10px';

            const title = document.createElement('div');
            title.innerText = `视频片段 ${index + 1}`;
            title.style.fontSize = '12px';
            title.style.color = '#ccc';
            item.appendChild(title);

            // 按钮 1: 直接下载 (Fetch Blob)
            const btnDownload = document.createElement('button');
            btnDownload.className = 'sjtu-dl-btn';
            btnDownload.innerText = '🚀 尝试直接下载 (推荐)';
            btnDownload.onclick = () => downloadWithBlob(url, btnDownload);
            item.appendChild(btnDownload);

            // 按钮 2: 复制 Curl 命令
            const btnCurl = document.createElement('button');
            btnCurl.className = 'sjtu-dl-btn secondary';
            btnCurl.innerText = '💻 复制终端命令 (备用)';
            btnCurl.title = "如果直接下载失败，请使用此方法";
            btnCurl.onclick = () => copyCurlCommand(url);
            item.appendChild(btnCurl);

            list.appendChild(item);
        });
    }

    // 循环检测
    let lastUrls = [];
    const runCheck = () => {
        const urls = findVideoUrl();
        if (urls.length !== lastUrls.length || !urls.every((u, i) => u === lastUrls[i])) {
            console.log("检测到新视频:", urls);
            lastUrls = urls;
            showDownloadUI(urls);
        }
    };
    
    setInterval(runCheck, 1500);
    runCheck();
    
    console.log("视频下载助手已就绪。");
    // 如果是首次加载且已有视频，显示提示
    if (findVideoUrl().length === 0) {
        alert("脚本已启动！\n\n请在页面上点击【播放】视频，下载选项会自动出现在右上角。");
    }

})();
