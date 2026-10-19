/**
 * 纪行手记 · Chronicle Scroll
 * SillyTavern 官方第三方扩展插件
 * 
 * 功能：
 * 1. 自动下发格式指令（setExtensionPrompt 动态注入，无需配置世界书）
 * 2. 自动拦截解析大模型回复，更新手记界面并洁净正文楼层
 * 3. 7大奇遇罗盘与营火旧梦交互玩法
 * 4. 艾欧泽亚 (FF14) 与 现代都市 双词库零代码可视化增删与管理
 */

(function () {
    const EXTENSION_NAME = 'st-chronicle-scroll';
    const EXTENSION_KEY = 'chronicle_scroll';

    // 默认内置词库缓存
    let poolEorzea = null;
    let poolModern = null;

    // 当前运行时词库引用
    let activePoolData = null;
    let currentCategory = 'voyage';

    // 当前抽取的临时暂存状态
    let currentRolls = {
        voyage: null,
        dungeon: null,
        treasure: null,
        cook: null,
        danger: null,
        beast: null,
        outfit: null,
        dream: null,
        souvenir: null,
        photo: null
    };

    /**
     * 获取或初始化扩展配置
     */
    function getSettings() {
        const context = SillyTavern.getContext();
        if (!context.extensionSettings[EXTENSION_KEY]) {
            context.extensionSettings[EXTENSION_KEY] = {
                enabled: true,
                hideRawTag: true,
                activePreset: 'eorzea',
                customPool: null
            };
        }
        return context.extensionSettings[EXTENSION_KEY];
    }

    function saveSettings() {
        const context = SillyTavern.getContext();
        context.saveSettingsDebounced();
    }

    /**
     * 1. 动态提示词注入 (Prompt Injection)
     * 在酒馆组装好 payload 准备发往 AI 前注入指令
     */
    function updateExtensionPrompt() {
        const settings = getSettings();
        if (!settings.enabled) {
            SillyTavern.getContext().setExtensionPrompt(EXTENSION_NAME, '', 1, 0, false);
            return;
        }

        const promptText = `
# 纪行手记输出规范 (系统级优先)
在每次回复结尾，必须使用以下格式输出当前冒险手记数据块。所有状态以文学感知与神态描写呈现，严禁数值：
<fantasy_scroll>
[Env|时间={{当前时段}};;天候={{当前气候风象}};;地界={{具体身处地点}};;环境观察={{当前环境氛围与以太感知}}]
[User|身份职业={{当前展现的身份}};;身心状态={{如神完气足/微感疲惫}};;神态装束={{衣着打扮与仪态}};;随身所持={{重要信物与随身物}}]
[Party|{{在场同伴/NPC名}}::{{身份}}::{{神色举止}}::{{当前动向}} (独行则填: 独行::冒险者::从容::独自行动)]
[Lover|注目角色={{当前最关注的互动角色}};;关系距离={{如初遇审视/莫逆之交/暗生情愫}};;表面心境={{显露的情绪}};;深层隐微={{未宣之于口的真实想法}}]
[World|{{传闻1}}::{{当前大地的暗流与消息}};;{{传闻2}}::{{市井流言}}]
[Quest|当前事态={{当下正在面对的情境}};;暗流线索={{可追查的疑点}};;心念所向={{下一步考量或去向}}]
</fantasy_scroll>
`.trim();

        // position: 1 (User/System尾部), depth: 0
        SillyTavern.getContext().setExtensionPrompt(EXTENSION_NAME, promptText, 1, 0, false);
    }

    /**
     * 加载内置词库文件
     */
    async function loadBuiltinPools() {
        try {
            const basePath = `scripts/extensions/third-party/${EXTENSION_NAME}/pools`;
            const [respE, respM] = await Promise.all([
                fetch(`${basePath}/eorzea.json`),
                fetch(`${basePath}/modern.json`)
            ]);
            poolEorzea = await respE.json();
            poolModern = await respM.json();
        } catch (err) {
            console.warn('[ChronicleScroll] 加载远程词库失败，启用内存兜底词库:', err);
            // 兜底极简词库
            poolEorzea = { id: 'eorzea', name: '艾欧泽亚传奇', pools: { voyage: [], camp_topics: [] } };
            poolModern = { id: 'modern', name: '都市漫游录', pools: { voyage: [], camp_topics: [] } };
        }
        resolveActivePool();
    }

    /**
     * 解析当前生效词库
     */
    function resolveActivePool() {
        const settings = getSettings();
        if (settings.activePreset === 'modern') {
            activePoolData = poolModern?.pools || {};
        } else if (settings.activePreset === 'custom' && settings.customPool) {
            activePoolData = settings.customPool.pools || {};
        } else {
            activePoolData = poolEorzea?.pools || {};
        }
    }

    /**
     * 2. 数据拦截与手记内容解析
     */
    function parseScrollData(rawPayload) {
        if (!rawPayload) return;
        const result = {
            env: {}, user: {}, lover: {}, quest: {}, party: [], world: []
        };

        const envMatch = rawPayload.match(/\[Env\|([\s\S]*?)\]/i);
        if (envMatch) {
            envMatch[1].split(';;').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) result.env[k.trim()] = v.trim();
            });
        }

        const userMatch = rawPayload.match(/\[User\|([\s\S]*?)\]/i);
        if (userMatch) {
            userMatch[1].split(';;').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) result.user[k.trim()] = v.trim();
            });
        }

        const loverMatch = rawPayload.match(/\[Lover\|([\s\S]*?)\]/i);
        if (loverMatch) {
            loverMatch[1].split(';;').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) result.lover[k.trim()] = v.trim();
            });
        }

        const questMatch = rawPayload.match(/\[Quest\|([\s\S]*?)\]/i);
        if (questMatch) {
            questMatch[1].split(';;').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) result.quest[k.trim()] = v.trim();
            });
        }

        const partyMatch = rawPayload.match(/\[Party\|([\s\S]*?)\]/i);
        if (partyMatch) {
            partyMatch[1].split(';;').forEach(part => {
                const chunks = part.split('::').map(c => c.trim());
                if (chunks.length >= 2) {
                    result.party.push({ name: chunks[0], role: chunks[1], desc: chunks[2] || '', status: chunks[3] || '' });
                }
            });
        }

        const worldMatch = rawPayload.match(/\[World\|([\s\S]*?)\]/i);
        if (worldMatch) {
            worldMatch[1].split(';;').forEach(part => {
                const chunks = part.split('::').map(c => c.trim());
                if (chunks.length >= 2) {
                    result.world.push({ title: chunks[0], desc: chunks[1] });
                }
            });
        }

        renderScrollToModal(result);
    }

    /**
     * 将解析出的数据填入手记面板
     */
    function renderScrollToModal(data) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) el.textContent = val;
        };

        if (data.env) {
            setVal('cs-field-time', data.env['时间'] || data.env['时刻']);
            setVal('cs-field-weather', data.env['天候'] || data.env['气候']);
            setVal('cs-field-loc', data.env['地界'] || data.env['地点']);
            setVal('cs-field-obs', data.env['环境观察']);
        }
        if (data.quest) {
            setVal('cs-quest-current', data.quest['当前事态']);
            setVal('cs-quest-clues', data.quest['暗流线索']);
            setVal('cs-quest-mind', data.quest['心念所向']);
        }
        if (data.user) {
            setVal('cs-user-role', data.user['身份职业'] || data.user['身份']);
            setVal('cs-user-state', data.user['身心状态']);
            setVal('cs-user-look', data.user['神态装束']);
            setVal('cs-user-items', data.user['随身所持']);
        }
        if (data.lover) {
            setVal('cs-lover-name', data.lover['注目角色']);
            setVal('cs-lover-dist', data.lover['关系距离']);
            setVal('cs-lover-surface', data.lover['表面心境']);
            setVal('cs-lover-deep', data.lover['深层隐微']);
        }

        // 渲染队伍
        const partyContainer = document.getElementById('cs-party-list-container');
        if (partyContainer && data.party.length > 0) {
            partyContainer.innerHTML = data.party.map(p => `
                <div class="cs-party-item">
                    <span class="name">${p.name}</span> (${p.role}) · 
                    <span class="status">${p.desc} ${p.status}</span>
                </div>
            `).join('');
        }

        // 渲染传闻
        const worldContainer = document.getElementById('cs-world-list-container');
        if (worldContainer && data.world.length > 0) {
            worldContainer.innerHTML = data.world.map(w => `
                <div class="cs-world-item">
                    <div class="title">${w.title}</div>
                    <div class="desc">${w.desc}</div>
                </div>
            `).join('');
        }
    }

    /**
     * 3. 消息渲染事件监听与正文洁净
     */
    function onCharacterMessageRendered(messageId) {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        const msg = chat[messageId];
        if (!msg || !msg.mes) return;

        // 匹配 <fantasy_scroll> 或 <adventure_scroll>
        const regex = /<(?:fantasy_scroll|adventure_scroll)>([\s\S]*?)<\/(?:fantasy_scroll|adventure_scroll)>/i;
        const match = msg.mes.match(regex);
        if (match) {
            parseScrollData(match[1]);

            // 如果开启楼层洁净，隐藏正文中的标签代码
            const settings = getSettings();
            if (settings.hideRawTag) {
                const messageDom = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
                if (messageDom) {
                    messageDom.innerHTML = messageDom.innerHTML.replace(
                        /<(?:fantasy_scroll|adventure_scroll)>[\s\S]*?<\/(?:fantasy_scroll|adventure_scroll)>/gi,
                        '<div class="cs-badge-pill" style="margin-top:8px;padding:3px 10px;display:inline-block;border-radius:12px;background:rgba(179,135,40,0.15);font-size:11px;color:#a67c1e;">[已记录入手记]</div>'
                    );
                }
            }
        }
    }

    /**
     * 4. 玩法轮盘随机与发送动作
     */
    function getRandomItem(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function rollCategory(cat) {
        if (!activePoolData || !activePoolData[cat]) return;
        const pool = activePoolData[cat];
        const item = getRandomItem(pool);
        currentRolls[cat] = item;
        return item;
    }

    function executeSend(actionPrompt, directSay) {
        const text = directSay || actionPrompt;
        const textarea = document.getElementById('send_textarea');
        if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            const sendBtn = document.getElementById('send_but');
            if (sendBtn) sendBtn.click();
        }
        // 关闭手记弹窗
        document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
    }

    /**
     * 5. 挂载手记模态框到主窗口
     */
    async function mountModal() {
        if (document.getElementById('cs-global-toggle-btn')) return;

        const modalResp = await fetch(`scripts/extensions/third-party/${EXTENSION_NAME}/templates/scroll-modal.html`);
        const modalHtml = await modalResp.text();

        const container = document.createElement('div');
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

        // 绑定悬浮开书按钮
        document.getElementById('cs-global-toggle-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('cs-book-modal-wrapper');
            modal.classList.toggle('cs-hidden');
        });

        document.getElementById('cs-close-book')?.addEventListener('click', () => {
            document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
        });

        document.getElementById('cs-modal-backdrop')?.addEventListener('click', () => {
            document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
        });

        // 视界主题切换
        document.getElementById('cs-theme-toggle')?.addEventListener('click', () => {
            const book = document.getElementById('cs-main-book');
            book.classList.toggle('cs-theme-classic');
            book.classList.toggle('cs-theme-dark');
        });

        // 7 大书签切换
        document.querySelectorAll('#cs-nav-bookmarks .cs-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#cs-nav-bookmarks .cs-bookmark').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.cs-page').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(`cs-tab-${tabId}`)?.classList.add('active');
            });
        });

        // 翻转卡片
        document.getElementById('cs-lover-flip-card')?.addEventListener('click', function () {
            this.classList.toggle('flipped');
        });

        // 子标签切换通用逻辑
        const bindSubtabs = (containerId, panePrefix) => {
            document.querySelectorAll(`#${containerId} .cs-subtab-btn`).forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll(`#${containerId} .cs-subtab-btn`).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mod = btn.getAttribute('data-mod');
                    document.querySelectorAll(`[id^="${panePrefix}"]`).forEach(p => p.classList.add('cs-hidden'));
                    document.getElementById(`${panePrefix}${mod}`)?.classList.remove('cs-hidden');
                });
            });
        };
        bindSubtabs('cs-voyage-subtabs', 'cs-pane-');
        bindSubtabs('cs-camp-subtabs', 'cs-pane-');
        bindSubtabs('cs-post-subtabs', 'cs-pane-');

        // 绑定各玩法抽取与发送事件
        bindGameplayActions();
    }

    function bindGameplayActions() {
        // 未知漫游
        document.getElementById('cs-btn-roll-voyage')?.addEventListener('click', () => {
            const item = rollCategory('voyage');
            if (!item) return;
            document.getElementById('cs-v-biome').textContent = item.biome;
            document.getElementById('cs-v-sense').textContent = item.sense;
            document.getElementById('cs-v-race').textContent = item.race;
            document.getElementById('cs-v-traits').textContent = item.traits;
            document.getElementById('cs-v-custom').textContent = item.custom;
            document.getElementById('cs-v-incident').textContent = item.incident;
            document.getElementById('cs-v-bond').textContent = item.bond;
        });

        document.getElementById('cs-btn-depart-voyage')?.addEventListener('click', () => {
            const item = currentRolls.voyage || rollCategory('voyage');
            if (!item) return;
            executeSend(`让我们启程前往【${item.biome}】吧。`);
        });

        // 秘境迷宫
        document.getElementById('cs-btn-roll-dungeon')?.addEventListener('click', () => {
            const item = rollCategory('dungeon');
            if (!item) return;
            document.getElementById('cs-dg-name').textContent = item.name;
            document.getElementById('cs-dg-desc').textContent = item.desc;
            document.getElementById('cs-dg-trap').textContent = item.trap;
            document.getElementById('cs-dg-reward').textContent = item.reward;
        });
        document.getElementById('cs-btn-send-dungeon')?.addEventListener('click', () => {
            const item = currentRolls.dungeon || rollCategory('dungeon');
            if (item) executeSend(`深入探索${item.name}。`);
        });

        // 寻宝探秘
        document.getElementById('cs-btn-roll-treasure')?.addEventListener('click', () => {
            const item = rollCategory('treasure');
            if (!item) return;
            document.getElementById('cs-tr-map').textContent = item.map;
            document.getElementById('cs-tr-riddle').textContent = item.riddle;
            document.getElementById('cs-tr-loot').textContent = item.loot;
        });
        document.getElementById('cs-btn-send-treasure')?.addEventListener('click', () => {
            const item = currentRolls.treasure || rollCategory('treasure');
            if (item) executeSend(`跟随${item.map}的线索寻宝。`);
        });

        // 荒野野炊
        document.getElementById('cs-btn-roll-cook')?.addEventListener('click', () => {
            const item = rollCategory('cook');
            if (!item) return;
            document.getElementById('cs-ck-name').textContent = item.name;
            document.getElementById('cs-ck-taste').textContent = item.taste;
            document.getElementById('cs-ck-bond').textContent = item.bond;
        });
        document.getElementById('cs-btn-send-cook')?.addEventListener('click', () => {
            const item = currentRolls.cook || rollCategory('cook');
            if (item) executeSend(`动手支锅，尝尝新烹制的${item.name}。`);
        });

        // 突发险情
        document.getElementById('cs-btn-roll-danger')?.addEventListener('click', () => {
            const item = rollCategory('danger');
            if (!item) return;
            document.getElementById('cs-dg-event').textContent = item.event;
            document.getElementById('cs-dg-pinch').textContent = item.pinch;
            document.getElementById('cs-dg-reaction').textContent = item.reaction;
        });
        document.getElementById('cs-btn-send-danger')?.addEventListener('click', () => {
            const item = currentRolls.danger || rollCategory('danger');
            if (item) executeSend(`面对突发异变${item.event}，我们相依突围。`);
        });

        // 奇珍萌物
        document.getElementById('cs-btn-roll-beast')?.addEventListener('click', () => {
            const item = rollCategory('beast');
            if (!item) return;
            document.getElementById('cs-bt-name').textContent = item.name;
            document.getElementById('cs-bt-habit').textContent = item.habit;
            document.getElementById('cs-bt-bond').textContent = item.bond;
        });
        document.getElementById('cs-btn-send-beast')?.addEventListener('click', () => {
            const item = currentRolls.beast || rollCategory('beast');
            if (item) executeSend(`记录奇珍【${item.name}】入图鉴。`);
        });

        // 营火夜谈
        document.getElementById('cs-btn-start-camp')?.addEventListener('click', () => {
            const select = document.getElementById('cs-camp-topic-select');
            const topic = select ? select.value : '深夜私语';
            executeSend(`在营火与夜色中，聊聊关于${topic}的心里话。`);
        });

        // 纪念行囊
        document.getElementById('cs-btn-roll-bag')?.addEventListener('click', () => {
            const item = rollCategory('souvenirs');
            if (!item) return;
            document.getElementById('cs-souvenir-name').textContent = item.name;
            document.getElementById('cs-souvenir-desc').textContent = item.desc;
            document.getElementById('cs-souvenir-mem').textContent = item.mem;
        });
        document.getElementById('cs-btn-send-bag')?.addEventListener('click', () => {
            const item = currentRolls.souvenirs || rollCategory('souvenirs');
            if (item) executeSend(`从行囊里翻出${item.name}，聊聊旧事。`);
        });

        // 拍立得
        document.getElementById('cs-btn-roll-photo')?.addEventListener('click', () => {
            const item = rollCategory('photos');
            if (!item) return;
            document.getElementById('cs-ph-scene').textContent = item.scene;
            document.getElementById('cs-ph-meta').textContent = item.meta;
            document.getElementById('cs-ph-caption').textContent = item.caption;
            document.getElementById('cs-ph-author').textContent = item.author;
        });
        document.getElementById('cs-btn-send-photo')?.addEventListener('click', () => {
            const item = currentRolls.photos || rollCategory('photos');
            if (item) executeSend(`按动快门，定格这一瞬的记忆。`);
        });

        // 刷新营火下拉列表
        refreshCampTopics();
    }

    function refreshCampTopics() {
        const select = document.getElementById('cs-camp-topic-select');
        if (!select || !activePoolData || !activePoolData.camp_topics) return;
        select.innerHTML = activePoolData.camp_topics.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    /**
     * 6. 可视化词库管理器 (Settings UI)
     */
    function setupSettingsUI() {
        const settings = getSettings();

        // 开关监听
        const injectToggle = document.getElementById('cs-auto-inject-toggle');
        if (injectToggle) {
            injectToggle.checked = settings.enabled;
            injectToggle.addEventListener('change', () => {
                settings.enabled = injectToggle.checked;
                saveSettings();
                updateExtensionPrompt();
            });
        }

        const hideTagToggle = document.getElementById('cs-hide-raw-tag');
        if (hideTagToggle) {
            hideTagToggle.checked = settings.hideRawTag;
            hideTagToggle.addEventListener('change', () => {
                settings.hideRawTag = hideTagToggle.checked;
                saveSettings();
            });
        }

        // 预设切换
        const presetSelect = document.getElementById('cs-active-preset-select');
        if (presetSelect) {
            presetSelect.value = settings.activePreset;
            presetSelect.addEventListener('change', () => {
                settings.activePreset = presetSelect.value;
                resolveActivePool();
                saveSettings();
                renderCategoryCards();
                refreshCampTopics();
            });
        }

        // 分类标签切换
        document.querySelectorAll('#cs-category-tabs .cs-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#cs-category-tabs .cs-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.getAttribute('data-cat');
                renderCategoryCards();
                renderAddForm();
            });
        });

        // 导出词库
        document.getElementById('cs-export-pool-btn')?.addEventListener('click', () => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activePoolData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `chronicle_pool_${settings.activePreset}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });

        // 上传词库
        const fileInput = document.getElementById('cs-pool-file-input');
        document.getElementById('cs-import-pool-btn')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    settings.customPool = parsed.pools ? parsed : { pools: parsed };
                    settings.activePreset = 'custom';
                    if (presetSelect) presetSelect.value = 'custom';
                    resolveActivePool();
                    saveSettings();
                    renderCategoryCards();
                    refreshCampTopics();
                    toastr.success('自定义词库已成功导入！');
                } catch (err) {
                    toastr.error('文件格式错误，非有效 JSON 词库！');
                }
            };
            reader.readAsText(file);
        });

        // 重置词库
        document.getElementById('cs-reset-pool-btn')?.addEventListener('click', () => {
            if (confirm('确定将当前词库重置回初始默认状态吗？')) {
                if (settings.activePreset === 'custom') settings.customPool = null;
                settings.activePreset = 'eorzea';
                if (presetSelect) presetSelect.value = 'eorzea';
                resolveActivePool();
                saveSettings();
                renderCategoryCards();
                refreshCampTopics();
                toastr.info('已恢复为初始默认预设。');
            }
        });

        // 提交添加新词条
        document.getElementById('cs-submit-add-btn')?.addEventListener('click', submitNewItem);

        renderCategoryCards();
        renderAddForm();
    }

    /**
     * 渲染当前分类下的条目卡片（带一键删除）
     */
    function renderCategoryCards() {
        const container = document.getElementById('cs-items-container');
        const statBadge = document.getElementById('cs-pool-stat');
        if (!container || !activePoolData) return;

        const list = activePoolData[currentCategory] || [];
        if (statBadge) statBadge.textContent = `当前分类计 ${list.length} 个词条`;

        if (list.length === 0) {
            container.innerHTML = '<div style="padding:15px;text-align:center;opacity:0.6;font-size:12px;">此分类下暂无词条，请在下方直接输入添加。</div>';
            return;
        }

        container.innerHTML = list.map((item, idx) => {
            let fieldsHtml = '';
            if (typeof item === 'string') {
                fieldsHtml = `<div class="cs-card-field-row">${item}</div>`;
            } else {
                fieldsHtml = Object.entries(item).map(([k, v]) => `
                    <div class="cs-card-field-row"><b>${k}：</b>${v}</div>
                `).join('');
            }

            return `
                <div class="cs-item-card" data-idx="${idx}">
                    <button type="button" class="cs-card-delete-btn" onclick="window.csDeleteItem(${idx})">删除</button>
                    ${fieldsHtml}
                </div>
            `;
        }).join('');
    }

    // 全局删除函数
    window.csDeleteItem = function (idx) {
        if (!activePoolData || !activePoolData[currentCategory]) return;
        activePoolData[currentCategory].splice(idx, 1);
        const settings = getSettings();
        if (settings.activePreset !== 'custom') {
            // 如果修改了内置预设，则自动克隆为 custom
            settings.customPool = { pools: JSON.parse(JSON.stringify(activePoolData)) };
            settings.activePreset = 'custom';
            const sel = document.getElementById('cs-active-preset-select');
            if (sel) sel.value = 'custom';
        }
        saveSettings();
        renderCategoryCards();
        refreshCampTopics();
    };

    /**
     * 动态生成适合当前分类的中文添加表单
     */
    function renderAddForm() {
        const formBox = document.getElementById('cs-dynamic-inputs');
        if (!formBox) return;

        const fieldConfigs = {
            voyage: [
                { id: 'f-biome', label: '地界名称', ph: '如：悬空浮岛 / 老城古着咖啡馆' },
                { id: 'f-sense', label: '五感环境', ph: '如：瀑布逆流向天际 / 咖啡豆浓郁烘焙香' },
                { id: 'f-race', label: '遇逢生灵/人群', ph: '如：长羽盲灵族 / 街角滑板青年' },
                { id: 'f-traits', label: '生灵体征特征', ph: '如：体态纤细柔白 / 身穿宽松工装' },
                { id: 'f-custom', label: '当地事态活动', ph: '如：一年一度水灯节 / 周末跳蚤市集' },
                { id: 'f-incident', label: '具体际遇情节', ph: '如：孩童捧出发光花瓣 / 老板多送一球抹茶冰淇淋' },
                { id: 'f-bond', label: '旅伴神态台词', ph: '如：他/她拂去尘露：“随你高兴罢。”' }
            ],
            dungeon: [
                { id: 'f-name', label: '迷宫/区域名称', ph: '如：【深海结晶灵庙】 / 【宜家样板迷宫】' },
                { id: 'f-desc', label: '环境特色描写', ph: '如：青蓝以太水幕流转 / 转角一个接一个永远找不到出口' },
                { id: 'f-trap', label: '解密机关障碍', ph: '如：双人注入共鸣石柱 / 陷入柔软双人沙发' },
                { id: 'f-boss', label: '阻碍守关者', ph: '如：万年白银守卫构装体 / 推满购物车的人潮' },
                { id: 'f-reward', label: '终局通关相伴', ph: '如：悬空石台牵手 / 抱着鲨鱼玩偶相视失笑' }
            ],
            treasure: [
                { id: 'f-map', label: '宝图/线索名称', ph: '如：【漂流密图】 / 【老城区探店手绘图】' },
                { id: 'f-riddle', label: '古图谜题引语', ph: '如：“当双生月在断崖交叠……”' },
                { id: 'f-lock', label: '解谜机关守卫', ph: '如：顺毛发光巨兽 / 长队与火爆手艺阿姨' },
                { id: 'f-loot', label: '出土宝物与趣闻', ph: '如：水晶发簪 / 刚出锅的小酥肉抢着吃' }
            ],
            cook: [
                { id: 'f-name', label: '风味料理名称', ph: '如：【浮岛晶鱼泥炉烧】 / 【暴雨深夜芝士辛拉面】' },
                { id: 'f-ing', label: '食材用料', ph: '如：发光飞鱼与雪花菌 / 辛拉面、厚切午餐肉与双层芝士' },
                { id: 'f-taste', label: '舌尖奇妙口感', ph: '如：焦香爽脆炸开微酸 / 热气腾腾红亮浓汤吸入满足' },
                { id: 'f-bond', label: '双人围炉喂食', ph: '如：细心挑出鱼刺喂进你嘴里 / 递来冰可乐擦掉嘴角辣油' }
            ],
            danger: [
                { id: 'f-event', label: '险情异变名称', ph: '如：【浮岛以太逆涌裂隙】 / 【暴雨且打不到车】' },
                { id: 'f-scene', label: '险境发生过程', ph: '如：石梁断裂滑入岩隙 / 雨伞翻折缩在站台' },
                { id: 'f-pinch', label: '狭窄贴身困境', ph: '如：紧紧相拥呼吸交缠 / 把伞全偏向你半肩湿透' },
                { id: 'f-reaction', label: '恋人的庇护', ph: '如：声音发颤抱紧：“你若出事我怎么办？”' }
            ],
            beast: [
                { id: 'f-name', label: '生灵名称', ph: '如：【星尘夜光水豚】 / 【便利店霸道胖橘】' },
                { id: 'f-look', label: '外貌特征', ph: '如：头顶小睡莲 / 浑圆如冬瓜挂小项圈' },
                { id: 'f-habit', label: '奇葩习性', ph: '如：非要钻进口袋当窝 / 瘫在鞋上假摔碰瓷' },
                { id: 'f-bond', label: '旅伴破防互动', ph: '如：嫌脏却身体僵硬不敢乱动 / 叹气蹲下给开罐头' }
            ],
            outfit: [
                { id: 'f-style', label: '装束风格名称', ph: '如：【极北加厚毛绒旅行斗篷】 / 【美式复古宽松连帽卫衣】' },
                { id: 'f-desc', label: '装束面料与细节', ph: '如：羊绒大衣与雪狐绒 / 一灰一藏青配直筒牛仔裤' },
                { id: 'f-react', label: '旅伴吃醋/系带动作', ph: '如：顺手帮你拉好兜帽 / 把手插进你卫衣口袋握紧' }
            ],
            camp_topics: [
                { id: 'f-text', label: '话题名称与描述', ph: '如：【深夜阳台】吹着凌晨两点的凉风聊聊年少梦想' }
            ],
            souvenirs: [
                { id: 'f-name', label: '信物名称', ph: '如：【风蚀空心鸣石】 / 【旧电影票根】' },
                { id: 'f-desc', label: '信物外观描述', ph: '如：吹气发出鸟鸣 / 泛黄卷边热敏纸票根' },
                { id: 'f-mem', label: '背后的专属回忆', ph: '如：偷偷找工匠打了银丝挂绳 / 第一次牵手触电般缩回' }
            ],
            photos: [
                { id: 'f-scene', label: '镜头分镜场景', ph: '如：【黄昏绝壁剪影】 / 【雨夜便利店玻璃对视】' },
                { id: 'f-meta', label: '光影与画面氛围', ph: '如：落日染红海面吹乱披风 / 暖黄灯光晕染温柔轮廓' },
                { id: 'f-caption', label: '手写批注留言', ph: '如：“头发吹得像雀尾。——真傻，但还算好看。”' },
                { id: 'f-author', label: '落款签名', ph: '如：—— 恋人 随身便签留字' }
            ]
        };

        const config = fieldConfigs[currentCategory] || [{ id: 'f-text', label: '内容', ph: '输入词条内容' }];
        formBox.innerHTML = config.map(item => `
            <div class="cs-input-group">
                <label>${item.label}</label>
                <input type="text" class="cs-input" id="${item.id}" placeholder="${item.ph}">
            </div>
        `).join('');
    }

    function submitNewItem() {
        if (!activePoolData) return;
        if (!activePoolData[currentCategory]) activePoolData[currentCategory] = [];

        let newItem = null;
        if (currentCategory === 'camp_topics') {
            const val = document.getElementById('f-text')?.value?.trim();
            if (!val) { toastr.warning('请输入话题内容！'); return; }
            newItem = val;
        } else {
            const inputs = document.querySelectorAll('#cs-dynamic-inputs input');
            newItem = {};
            let hasVal = false;
            inputs.forEach(input => {
                const key = input.id.replace('f-', '');
                const val = input.value.trim();
                if (val) hasVal = true;
                newItem[key] = val;
            });
            if (!hasVal) { toastr.warning('请至少填写一项内容！'); return; }
        }

        activePoolData[currentCategory].push(newItem);

        // 如果修改了内置预设，自动升级为 custom 存储
        const settings = getSettings();
        if (settings.activePreset !== 'custom') {
            settings.customPool = { pools: JSON.parse(JSON.stringify(activePoolData)) };
            settings.activePreset = 'custom';
            const sel = document.getElementById('cs-active-preset-select');
            if (sel) sel.value = 'custom';
        }

        saveSettings();
        renderCategoryCards();
        refreshCampTopics();

        // 清空输入框
        document.querySelectorAll('#cs-dynamic-inputs input').forEach(inp => inp.value = '');
        toastr.success('新词条已成功添加入库！');
    }

    /**
     * 初始化主入口
     */
    jQuery(async function () {
        console.log('[ChronicleScroll] 纪行手记扩展正在初始化...');
        await loadBuiltinPools();
        updateExtensionPrompt();
        await mountModal();

        // 监听酒馆原生事件
        const context = SillyTavern.getContext();
        const eventSource = context.eventSource;
        const eventTypes = context.eventTypes;

        if (eventSource && eventTypes) {
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (msgId) => onCharacterMessageRendered(msgId));
            eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, () => updateExtensionPrompt());
        }

        // 加载并注入设置面板
        try {
            const settingsResp = await fetch(`scripts/extensions/third-party/${EXTENSION_NAME}/templates/settings.html`);
            const settingsHtml = await settingsResp.text();
            const drawer = document.getElementById('extensions_settings');
            if (drawer) {
                const wrap = document.createElement('div');
                wrap.innerHTML = settingsHtml;
                drawer.appendChild(wrap);
                setupSettingsUI();
            }
        } catch (e) {
            console.warn('[ChronicleScroll] 加载设置面板失败:', e);
        }

        console.log('[ChronicleScroll] 纪行手记扩展已就绪。');
    });

})();
