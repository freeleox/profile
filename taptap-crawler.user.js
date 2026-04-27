// ==UserScript==
// @name         TapTap预约榜爬虫
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  爬取TapTap预约榜游戏数据（含二级页面详情），生成Excel表格下载
// @author       leomxiao
// @match        https://www.taptap.cn/top/reserve*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      www.taptap.cn
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
  'use strict';

  // ===================== iframe 检测 =====================
  let isInIframe = false;
  try {
    isInIframe = (window.self !== window.top);
  } catch (e) {
    isInIframe = true;
  }
  if (isInIframe) return;

  // ===================== 样式注入 =====================
  GM_addStyle(`
    /* ===== 爬虫触发按钮 ===== */
    #taptap-crawler-btn {
      position: fixed;
      left: 24px;
      bottom: 24px;
      z-index: 2147483647;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #00d9a6, #00b894);
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 217, 166, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #taptap-crawler-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(0, 217, 166, 0.65);
    }

    #taptap-crawler-btn:active {
      transform: scale(0.95);
    }

    #taptap-crawler-btn.crawling {
      background: linear-gradient(135deg, #fdcb6e, #e17055);
      animation: taptap-crawler-pulse 1.5s infinite;
      cursor: not-allowed;
    }

    @keyframes taptap-crawler-pulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(225, 112, 85, 0.45); }
      50% { box-shadow: 0 4px 24px rgba(225, 112, 85, 0.75); }
    }

    /* ===== 弹窗遮罩 ===== */
    #taptap-crawler-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      animation: taptap-fadeIn 0.2s ease;
    }

    #taptap-crawler-overlay.show {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes taptap-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ===== 弹窗主体 ===== */
    #taptap-crawler-modal {
      background: #fff;
      border-radius: 16px;
      padding: 32px;
      width: 460px;
      max-width: calc(100vw - 40px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      animation: taptap-slideUp 0.3s ease;
    }

    @keyframes taptap-slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    #taptap-crawler-modal h2 {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #taptap-crawler-modal .modal-desc {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 24px 0;
      line-height: 1.6;
    }

    #taptap-crawler-modal .input-group {
      margin-bottom: 20px;
    }

    #taptap-crawler-modal .input-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
    }

    #taptap-crawler-modal .input-group input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      font-size: 16px;
      color: #1e293b;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    #taptap-crawler-modal .input-group input:focus {
      border-color: #00b894;
    }

    #taptap-crawler-modal .input-group .hint {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 6px;
    }

    #taptap-crawler-modal .btn-group {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    #taptap-crawler-modal .btn {
      padding: 10px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    #taptap-crawler-modal .btn-cancel {
      background: #f1f5f9;
      color: #64748b;
    }

    #taptap-crawler-modal .btn-cancel:hover {
      background: #e2e8f0;
    }

    #taptap-crawler-modal .btn-start {
      background: linear-gradient(135deg, #00d9a6, #00b894);
      color: #fff;
    }

    #taptap-crawler-modal .btn-start:hover {
      box-shadow: 0 4px 12px rgba(0, 184, 148, 0.4);
    }

    /* ===== 进度条弹窗 ===== */
    #taptap-crawler-progress {
      display: none;
      position: fixed;
      left: 24px;
      bottom: 90px;
      z-index: 2147483647;
      background: #fff;
      border-radius: 14px;
      padding: 20px 24px;
      width: 360px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }

    #taptap-crawler-progress.show {
      display: block;
    }

    #taptap-crawler-progress .progress-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #taptap-crawler-progress .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    #taptap-crawler-progress .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d9a6, #00b894);
      border-radius: 4px;
      transition: width 0.3s ease;
      width: 0%;
    }

    #taptap-crawler-progress .progress-text {
      font-size: 12px;
      color: #64748b;
    }

    #taptap-crawler-progress .progress-detail {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
      max-height: 60px;
      overflow-y: auto;
    }

    /* ===== Toast ===== */
    .taptap-crawler-toast {
      position: fixed;
      left: 24px;
      bottom: 90px;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      max-width: 360px;
      word-break: break-all;
      transition: opacity 0.3s;
    }
  `);

  // ===================== 全局状态 =====================
  let isCrawling = false;

  // ===================== 创建 DOM =====================

  // 1. 触发按钮
  const crawlerBtn = document.createElement('button');
  crawlerBtn.id = 'taptap-crawler-btn';
  crawlerBtn.innerHTML = '🕷️';
  crawlerBtn.title = 'TapTap预约榜爬虫';
  document.body.appendChild(crawlerBtn);

  // 2. 弹窗遮罩 + 弹窗
  const overlay = document.createElement('div');
  overlay.id = 'taptap-crawler-overlay';
  overlay.innerHTML = `
    <div id="taptap-crawler-modal">
      <h2>🕷️ TapTap预约榜爬虫</h2>
      <p class="modal-desc">
        将爬取当前预约榜页面的游戏信息（含二级详情页），并生成Excel表格下载。
        <br>爬取过程中请勿关闭页面。
      </p>
      <div class="input-group">
        <label>需要爬取的游戏数量</label>
        <input type="number" id="taptap-crawl-count" min="1" max="200" value="10" placeholder="输入数量，如 10">
        <div class="hint">当前页面可见的游戏数量将作为上限。如需爬取多页数据，请输入更大的数字（脚本会自动翻页）。</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-cancel" id="taptap-crawl-cancel">取消</button>
        <button class="btn btn-start" id="taptap-crawl-start">🚀 开始爬取</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 3. 进度条
  const progressPanel = document.createElement('div');
  progressPanel.id = 'taptap-crawler-progress';
  progressPanel.innerHTML = `
    <div class="progress-title">
      <span>⏳</span>
      <span id="taptap-progress-title-text">准备中...</span>
    </div>
    <div class="progress-bar-bg">
      <div class="progress-bar-fill" id="taptap-progress-bar"></div>
    </div>
    <div class="progress-text" id="taptap-progress-text">0 / 0</div>
    <div class="progress-detail" id="taptap-progress-detail"></div>
  `;
  document.body.appendChild(progressPanel);

  // ===================== 事件绑定 =====================

  crawlerBtn.addEventListener('click', () => {
    if (isCrawling) {
      showToast('⏳ 正在爬取中，请稍候...');
      return;
    }
    overlay.classList.add('show');
    document.getElementById('taptap-crawl-count').focus();
  });

  document.getElementById('taptap-crawl-cancel').addEventListener('click', () => {
    overlay.classList.remove('show');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
    }
  });

  document.getElementById('taptap-crawl-start').addEventListener('click', () => {
    const countInput = document.getElementById('taptap-crawl-count');
    const count = parseInt(countInput.value, 10);
    if (isNaN(count) || count < 1) {
      showToast('⚠️ 请输入有效的游戏数量（≥1）');
      return;
    }
    overlay.classList.remove('show');
    startCrawling(count);
  });

  // 回车确认
  document.getElementById('taptap-crawl-count').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('taptap-crawl-start').click();
    }
  });

  // ===================== 核心爬取逻辑 =====================

  async function startCrawling(totalCount) {
    if (isCrawling) return;
    isCrawling = true;
    crawlerBtn.classList.add('crawling');
    crawlerBtn.innerHTML = '⏳';

    updateProgress(true, '正在爬取一级页面...', 0, totalCount, '');

    try {
      // 第一步：爬取一级页面数据
      const primaryData = await crawlPrimaryPages(totalCount);

      if (primaryData.length === 0) {
        showToast('❌ 未找到任何游戏数据，请检查页面');
        return;
      }

      updateProgress(true, '正在爬取二级页面详情...', 0, primaryData.length, '');

      // 第二步：逐个爬取二级页面
      for (let i = 0; i < primaryData.length; i++) {
        const game = primaryData[i];
        updateProgress(true, '正在爬取二级页面详情...', i, primaryData.length, `正在爬取: ${game.gameName}`);

        if (game.detailUrl) {
          try {
            const detail = await crawlDetailPage(game.detailUrl);
            Object.assign(game, detail);
          } catch (err) {
            console.error(`[TapTap爬虫] 爬取二级页面失败: ${game.gameName}`, err);
            game.crawlError = err.message;
          }
        }

        // 每次请求间隔，避免被限流
        if (i < primaryData.length - 1) {
          await sleep(1000 + Math.random() * 1500);
        }
      }

      updateProgress(true, '正在生成Excel...', primaryData.length, primaryData.length, '');

      // 第三步：生成 Excel
      generateExcel(primaryData);

      updateProgress(false);
      showToast('🎉 爬取完成！Excel文件已下载');

    } catch (err) {
      console.error('[TapTap爬虫] 爬取失败:', err);
      showToast('❌ 爬取失败: ' + err.message);
      updateProgress(false);
    } finally {
      isCrawling = false;
      crawlerBtn.classList.remove('crawling');
      crawlerBtn.innerHTML = '🕷️';
    }
  }

  /**
   * 爬取一级页面数据
   * 支持自动翻页
   */
  async function crawlPrimaryPages(totalCount) {
    const allGames = [];

    // 获取当前页码
    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get('page'), 10) || 1;

    while (allGames.length < totalCount) {
      const pageUrl = `https://www.taptap.cn/top/reserve?page=${currentPage}`;
      updateProgress(true, `正在爬取第 ${currentPage} 页...`, allGames.length, totalCount, `页面: ${pageUrl}`);

      let html;
      if (currentPage === (parseInt(urlParams.get('page'), 10) || 1)) {
        // 当前页直接从 DOM 获取
        html = document.documentElement.outerHTML;
      } else {
        // 其他页面通过请求获取
        html = await fetchPage(pageUrl);
        await sleep(800 + Math.random() * 1200);
      }

      const pageGames = parsePrimaryPage(html);
      if (pageGames.length === 0) {
        console.log(`[TapTap爬虫] 第 ${currentPage} 页无数据，停止翻页`);
        break;
      }

      for (const game of pageGames) {
        if (allGames.length >= totalCount) break;
        allGames.push(game);
      }

      currentPage++;
    }

    console.log(`[TapTap爬虫] 一级页面共爬取 ${allGames.length} 个游戏`);
    return allGames;
  }

  /**
   * 解析一级页面 HTML，提取游戏列表
   */
  function parsePrimaryPage(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const games = [];

    // 查找游戏卡片
    const gameCells = doc.querySelectorAll('.game-list-cell, .rank-game-cell');
    console.log(`[TapTap爬虫] 当前页找到 ${gameCells.length} 个游戏卡片`);

    gameCells.forEach((cell) => {
      const game = {};

      // 1. 游戏名
      const nameEl = cell.querySelector('.text.text-default--size');
      game.gameName = nameEl ? nameEl.textContent.trim() : '';

      // 备用：从 meta itemprop="name" 获取
      if (!game.gameName) {
        const metaName = cell.querySelector('meta[itemprop="name"]');
        game.gameName = metaName ? metaName.getAttribute('content') : '未知游戏';
      }

      // 2. 设备支持
      const platformEl = cell.querySelector('.game-platform-tag');
      game.platform = platformEl ? platformEl.textContent.trim() : '';

      // 3. 备注（提示信息）
      const hintEl = cell.querySelector('.app-row-card__hint');
      game.remark = hintEl ? hintEl.textContent.trim() : '';

      // 4. 详情页链接
      const linkEl = cell.querySelector('a[href*="/app/"]');
      if (linkEl) {
        const href = linkEl.getAttribute('href');
        game.detailUrl = href.startsWith('http') ? href : `https://www.taptap.cn${href}`;
      } else {
        game.detailUrl = '';
      }

      // 5. 预约榜排名 - 从一级页面的 .rank-index 元素提取
      const rankEl = cell.querySelector('.rank-index');
      if (rankEl) {
        // 元素内容类似 "6 <!---->"，提取纯数字
        const rankText = rankEl.textContent.trim();
        const rankMatch = rankText.match(/(\d+)/);
        game.reserveRank = rankMatch ? '#' + rankMatch[1] : '';
      } else {
        game.reserveRank = '';
      }

      // 初始化二级数据字段
      game.reserveCount = '';
      game.onlineDate = '';
      game.tags = '';
      game.vendor = '';
      game.crawlError = '';

      if (game.gameName) {
        games.push(game);
      }
    });

    return games;
  }

  /**
   * 爬取二级详情页面
   */
  async function crawlDetailPage(url) {
    const html = await fetchPage(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const detail = {};

    // 注意：预约榜排名已在一级页面通过 .rank-index 获取，此处不再重复爬取

    // 1. 预约人数 - 含"万"字的数值
    // 查找 single-info 区域
    const singleInfoAreas = doc.querySelectorAll('.single-info__content__value');
    for (const el of singleInfoAreas) {
      const text = el.textContent.trim();
      // 匹配类似 "569 万"、"12.3 万"、"1000"
      if (/^\d[\d,.]*\s*万?$/.test(text) && !text.startsWith('#')) {
        detail.reserveCount = text;
        break;
      }
    }

    // 备用：更宽泛地查找预约人数
    if (!detail.reserveCount) {
      const allEls = doc.querySelectorAll('.gray-07, .single-info__content__value');
      for (const el of allEls) {
        const text = el.textContent.trim();
        if (/^\d[\d,.]*\s*万$/.test(text)) {
          detail.reserveCount = text;
          break;
        }
      }
    }

    // 3. 上线日期 - YYYY/MM/DD 格式
    for (const el of singleInfoAreas) {
      const text = el.textContent.trim();
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
        detail.onlineDate = text;
        break;
      }
    }

    // 备用方案
    if (!detail.onlineDate) {
      const allEls = doc.querySelectorAll('.gray-07, .single-info__content__value, .tap-text__one-line');
      for (const el of allEls) {
        const text = el.textContent.trim();
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
          detail.onlineDate = text;
          break;
        }
      }
    }

    // 4. 标签 - app-intro__tag-item
    const tagEls = doc.querySelectorAll('.app-intro__tag-item, .tap-chip');
    const tags = [];
    tagEls.forEach(el => {
      const text = el.textContent.trim();
      if (text && !tags.includes(text)) {
        tags.push(text);
      }
    });
    detail.tags = tags.join('、');

    // 5. 厂商 - 供应商信息
    const vendorEls = doc.querySelectorAll('.privacy-policy-info, [class*="privacy-policy"]');
    for (const el of vendorEls) {
      const text = el.textContent.trim();
      if (text.includes('供应商')) {
        // 提取"供应商"后面的公司名称
        detail.vendor = text.replace('供应商', '').trim();
        break;
      }
    }

    // 备用：宽泛搜索厂商信息
    if (!detail.vendor) {
      const allEls = doc.querySelectorAll('.gray-06, .caption-m10-w12');
      for (const el of allEls) {
        const text = el.textContent.trim();
        if (text.includes('供应商')) {
          detail.vendor = text.replace('供应商', '').trim();
          break;
        }
      }
    }

    console.log(`[TapTap爬虫] 二级页面数据:`, detail);
    return detail;
  }

  /**
   * 通过 GM_xmlhttpRequest 获取页面 HTML
   * 绕过同源限制
   */
  function fetchPage(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent': navigator.userAgent,
          'Referer': 'https://www.taptap.cn/',
        },
        timeout: 30000,
        onload: function (response) {
          if (response.status >= 200 && response.status < 400) {
            resolve(response.responseText);
          } else {
            reject(new Error(`HTTP ${response.status}: ${url}`));
          }
        },
        onerror: function (err) {
          reject(new Error(`请求失败: ${url} - ${err.error || '未知错误'}`));
        },
        ontimeout: function () {
          reject(new Error(`请求超时: ${url}`));
        },
      });
    });
  }

  /**
   * 生成 Excel 文件并下载
   */
  function generateExcel(data) {
    // 定义表头
    const headers = [
      '序号',
      '游戏名',
      '设备支持',
      '备注',
      '预约榜排名',
      '预约人数',
      '上线日期',
      '标签',
      '厂商',
      '详情页链接',
      '爬取备注',
    ];

    // 构建数据行
    const rows = data.map((game, index) => [
      index + 1,
      game.gameName || '',
      game.platform || '',
      game.remark || '',
      game.reserveRank || '',
      game.reserveCount || '',
      game.onlineDate || '',
      game.tags || '',
      game.vendor || '',
      game.detailUrl || '',
      game.crawlError || '',
    ]);

    // 使用 SheetJS 创建工作簿
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 20 },  // 游戏名
      { wch: 12 },  // 设备支持
      { wch: 25 },  // 备注
      { wch: 12 },  // 预约榜排名
      { wch: 12 },  // 预约人数
      { wch: 14 },  // 上线日期
      { wch: 30 },  // 标签
      { wch: 35 },  // 厂商
      { wch: 40 },  // 详情页链接
      { wch: 20 },  // 爬取备注
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'TapTap预约榜');

    // 生成文件名（含日期和页码）
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `TapTap预约榜_${data.length}款游戏_${dateStr}_${timeStr}.xlsx`;

    // 下载
    XLSX.writeFile(wb, fileName);
    console.log(`[TapTap爬虫] Excel 已生成: ${fileName}`);
  }

  // ===================== UI 辅助函数 =====================

  function updateProgress(show, title, current, total, detail) {
    const panel = document.getElementById('taptap-crawler-progress');
    if (!show) {
      panel.classList.remove('show');
      return;
    }
    panel.classList.add('show');
    document.getElementById('taptap-progress-title-text').textContent = title || '处理中...';
    document.getElementById('taptap-progress-text').textContent = `${current} / ${total}`;
    document.getElementById('taptap-progress-detail').textContent = detail || '';
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('taptap-progress-bar').style.width = pct + '%';
  }

  function showToast(msg, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'taptap-crawler-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
