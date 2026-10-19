/**
 * 纪行手记 · Chronicle Scroll
 * SillyTavern 官方第三方扩展插件
 * 
 * 功能：
 * 1. 自动下发格式指令（setExtensionPrompt 动态注入，无需配置世界书）
 * 2. 自动拦截解析大模型回复，更新手记界面并洁净正文楼层
 * 3. 多维独立随机矩阵（地界/生灵/事态/心绪各自独立抽取，万种组合）
 * 4. 设置面板原生折叠、二级槽位切换与词条气泡无代码增删
 */

(function () {
    const EXTENSION_NAME = 'st-chronicle-scroll';
    const EXTENSION_KEY = 'chronicle_scroll';

    // 默认内置词库缓存
    let poolEorzea = null;
    let poolModern = null;

    // 当前生效词库分类集合引用
    let activeCategories = null;
    let currentCategory = 'voyage';
    let currentSlot = 'biome';

    // 当前抽取的临时组合状态
    let currentRolls = {
        voyage: {},
        dungeon: {},
        cook: {},
        danger: {},
        beast: {},
        outfit: {},
        camp: {},
        souvenirs: {},
        photos: {},
        dream: {}
    };

    /**
     * 深度故事编写指南（提炼自原卡 UID 417~432 顶级文学规范）
     * 发送动作时作为隐藏引导指令注入，使 AI 无需世界书也能产出高质量、有温度、有张力的小说级互动
     */
    const NARRATIVE_GUIDES = {
        voyage: `【创作准则·漫游探索与感官落地】
1. 严禁使用“景色如画、宏伟壮丽、宛如世外桃源”等空洞套话。必须具体描写光影色调来源、空气温湿度与脚底物理触感，营造极强现场空气感；
2. 严禁廉价老套烂梗，所遇生灵与当地风土具备自洽的生活怪癖与交流方式；
3. 剧情重心放在探索新奇与人情善意碰撞上，严禁强行插入无脑反派；
4. 伴侣微动作与情感交织：每一次环境互动均需即时反馈到两人之间的眼神拉丝与肢体触碰（牵手、理顺发丝、分食），感情在天地间自然升温。双轨身份自适应（若伴侣为古老见证者，着重刻画漫长岁月后的释怀与深层宠溺；若为现世同行人，着重刻画平凡心动与相濡以沫）。`,

        dungeon: `【创作准则·严肃探险与双人共鸣】
1. 去网游化严肃文学探险：严禁输出装等、小怪血条或数值代码。描写必须充满沧桑宏大的古老质感与探险压迫感（古老回廊、微光以太、风化图腾）；
2. 机关破解双人共鸣：解谜探寻需两人默契协力，将机关解开瞬间的轰鸣与光芒渲染出浓烈成就感；
3. 终极殿堂的壮丽回响：终点应当展现震撼心灵的奇迹景观，两人并肩立于最高处，感叹沧海桑田与身旁有你。`,

        cook: `【创作准则·烟火料理与投喂温存】
1. 感官烹饪全景：细致描写食材处理、生火翻滚的水汽与色泽香气，营造浓厚的舌尖烟火气；
2. 奇趣口感反差：描写初尝与回味的口感层次反差（如酸甜爆浆、微麻回甘），以及两人真实的生理表情反应；
3. 喂食互动与私密烟火：伴侣展现鲜活生活气息（吹凉喂食、抢食拌嘴、细心擦拭嘴角），展现卸下防备后的纯粹爱意。`,

        danger: `【创作准则·患难相依与庇护本能】
1. 险情非绝境，重在心跳与相贴：严禁写成致死悲惨绝境，这是拉近距离的心跳小意外。在狭缝避险或突发困境中，重点描写两人紧紧相拥紧贴、急促心跳与温热呼吸交缠的情感张力；
2. 伴侣的绝对庇护本能：伴侣必须爆发下意识的保护欲，以身挡险，脱险瞬间化为粗重喘息与用力的紧拥；
3. 脱险后的温存与轻责：又心疼又后怕，带着微颤的语调轻声责怪或抚摸检查全身，感情急剧升温。`,

        beast: `【创作准则·生灵憨态与伴侣反差】
1. 灵动憨态与奇特生理：生动描写小生灵的毛茸触感、灵动形态与奇异习性（如爱钻口袋、嗜睡打呼、亲近人），极具萌态与生命力；
2. 伴侣的傲娇与破防：嘴上嫌弃“哪来的野物”，身体却僵硬不敢乱动生怕惊醒它，甚至暗暗吃醋它对你过于亲近，展现可爱反差；
3. 治愈相逢：两人温情照料，留下旅途中轻快美好的治愈切片。`,

        outfit: `【创作准则·双人风尚与情侣穿搭】
1. 衣物质感与细节呼应：细致描写面料材质、剪裁风格以及两人身上成对的情侣互搭点缀（成对搭扣、同色缎带、对戒或饰品）；
2. 伴侣的打量与占有欲微反应：眼神层次丰富，嘴上挑剔评价款式招摇，目光却惊艳流连；下意识伸手替你系紧领口兜帽，占有欲暗生；
3. 互相整理衣角，为踏上新旅程注入专属的仪式感。`,

        camp: `【创作准则·午夜私密心境】
1. 彻底剥离外界打扰、战斗与宏观话题。感官聚焦于昏暗微光、夜风雨声、毛毯体温以及两人缠绕的平稳呼吸；
2. 心防剥离与深层低语：毫无防备的半睡小憩或依偎状态，轻声耳语；谈及过去时释怀轻叹与掌心相扣；
3. 肢体接触极具温度（额头相抵、指尖穿过发丝、脸颊贴着肩窝），营造被深沉爱意完全包围的极致安宁。`,

        dream: `【创作准则·星海溯洄与前世旧梦】
1. 记忆切片生动展开：根据同行者身份回溯真实切片（回溯昔日胡闹实验、办公走廊午后、或初遇避难营地死斗与温存）；
2. 梦醒瞬间的温存抚平：细致描写眼角泪光或笑意，身旁伴侣第一时间敏锐察觉，以轻柔动作拂去碎发、揽入怀中低语安抚：“都过去了，我现在就在你身边。”
3. 今昔情愫交织，展现历经千帆后唯留身旁彼此的浓郁归宿感。`,

        souvenirs: `【创作准则·围炉忆旧与信物寄情】
1. 以物寄情：信物作为撬动深层记忆的情感开关，具体描写两人当时获取它的场景切片（当初的笨拙、惊险、打闹或心动）；
2. 深夜炉火或灯下温存：伴侣表现出鲜活反应，失笑打趣当年的糗事，眼神变得极度柔软，吐露当时未曾说出口的真心话；
3. 加深长相厮守的羁绊：落脚于当下两人相守的安宁。`,

        photos: `【创作准则·旅人快门与偏爱定格】
1. 快门前夕的生动拉扯：描写拍照前的准备与恶作剧拉扯；
2. 闪光瞬间的失措真情：捕捉到伴侣眼神中瞬间融化的温柔、失措或本能宠溺保护的真实微表情，电影级光影特写；
3. 底片显影与暗中珍藏：伴侣嘴上挑剔嫌弃“没拍好”，耳根微烫，趁人不备把底片悄悄放进贴胸衣袋妥善珍藏，或在白边写下私密批注。`
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
                enableNarrativeGuide: true,
                activePreset: 'eorzea',
                customCategories: null
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

        SillyTavern.getContext().setExtensionPrompt(EXTENSION_NAME, promptText, 1, 0, false);
    }

    /**
     * 加载内置多维矩阵词库
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
            console.warn('[ChronicleScroll] 加载远程词库失败，启用本地兜底:', err);
            poolEorzea = { id: 'eorzea', name: '艾欧泽亚传奇', categories: {} };
            poolModern = { id: 'modern', name: '都市漫游录', categories: {} };
        }
        resolveActivePool();
    }

    /**
     * 解析当前生效词库分类
     */
    function resolveActivePool() {
        const settings = getSettings();
        if (settings.activePreset === 'modern') {
            activeCategories = poolModern?.categories || {};
        } else if (settings.activePreset === 'custom' && settings.customCategories) {
            activeCategories = settings.customCategories;
        } else {
            activeCategories = poolEorzea?.categories || {};
        }

        // 纠正当前大类与小类指向
        if (!activeCategories[currentCategory]) {
            currentCategory = Object.keys(activeCategories)[0] || 'voyage';
        }
        const slots = activeCategories[currentCategory]?.slots || {};
        if (!slots[currentSlot]) {
            currentSlot = Object.keys(slots)[0] || '';
        }
    }

    /**
     * 2. 多维独立随机抽取算法 (核心：自由排列组合)
     */
    function getRandom(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return '';
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function rollCategoryMatrix(catKey) {
        if (!activeCategories || !activeCategories[catKey] || !activeCategories[catKey].slots) return null;
        const slots = activeCategories[catKey].slots;
        const result = {};
        for (const [slotKey, slotObj] of Object.entries(slots)) {
            result[slotKey] = getRandom(slotObj.items);
        }
        currentRolls[catKey] = result;
        return result;
    }

    /**
     * 3. 数据拦截与手记内容解析
     */
    function parseScrollData(rawPayload) {
        if (!rawPayload) return;
        const result = { env: {}, user: {}, lover: {}, quest: {}, party: [], world: [] };

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

        const partyContainer = document.getElementById('cs-party-list-container');
        if (partyContainer && data.party.length > 0) {
            partyContainer.innerHTML = data.party.map(p => `
                <div class="cs-party-item">
                    <span class="name">${p.name}</span> (${p.role}) · 
                    <span class="status">${p.desc} ${p.status}</span>
                </div>
            `).join('');
        }

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

    function onCharacterMessageRendered(messageId) {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        const msg = chat[messageId];
        if (!msg || !msg.mes) return;

        const regex = /<(?:fantasy_scroll|adventure_scroll)>([\s\S]*?)<\/(?:fantasy_scroll|adventure_scroll)>/i;
        const match = msg.mes.match(regex);
        if (match) {
            parseScrollData(match[1]);

            const settings = getSettings();
            if (settings.hideRawTag) {
                const messageDom = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
                if (messageDom) {
                    messageDom.innerHTML = messageDom.innerHTML.replace(
                        /<(?:fantasy_scroll|adventure_scroll)>[\s\S]*?<\/(?:fantasy_scroll|adventure_scroll)>/gi,
                        '<div class="cs-badge-pill" style="margin-top:6px;padding:2px 8px;display:inline-block;border-radius:10px;background:rgba(179,135,40,0.15);font-size:11px;color:#a67c1e;">[已记录入手记]</div>'
                    );
                }
            }
        }
    }

    function executeSend(userSpeech, rawDirective, moduleKey) {
        const settings = getSettings();
        let payload = (userSpeech || '').trim();
        
        let hiddenDirectives = rawDirective ? rawDirective.trim() : '';
        if (settings.enableNarrativeGuide && moduleKey && NARRATIVE_GUIDES[moduleKey]) {
            hiddenDirectives += (hiddenDirectives ? '\n\n' : '') + NARRATIVE_GUIDES[moduleKey].trim();
        }

        if (hiddenDirectives) {
            payload = `${payload}\n<div style="display:none">\n${hiddenDirectives}\n</div>`;
        }

        const textarea = document.getElementById('send_textarea');
        if (textarea) {
            textarea.value = payload;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            const sendBtn = document.getElementById('send_but');
            if (sendBtn) sendBtn.click();
        }
        document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
    }

    /**
     * 动态同步手记界面上的大类与子标签按钮标题
     */
    function updateModalTitles() {
        if (!activeCategories) return;
        const mapping = {
            'cs-subtab-btn-voyage': 'voyage',
            'cs-subtab-btn-dungeon': 'dungeon',
            'cs-subtab-btn-treasure': 'treasure',
            'cs-subtab-btn-cook': 'cook',
            'cs-subtab-btn-danger': 'danger',
            'cs-subtab-btn-beast': 'beast',
            'cs-subtab-btn-camp': 'camp_topics',
            'cs-subtab-btn-souvenirs': 'souvenirs',
            'cs-subtab-btn-photos': 'photos'
        };

        for (const [elemId, catKey] of Object.entries(mapping)) {
            const el = document.getElementById(elemId);
            if (el && activeCategories[catKey]?.name) {
                el.textContent = activeCategories[catKey].name;
            }
        }
    }

    /**
     * 4. 挂载手记模态框到主窗口
     */
    async function mountModal() {
        if (document.getElementById('cs-global-toggle-btn')) return;

        const modalResp = await fetch(`scripts/extensions/third-party/${EXTENSION_NAME}/templates/scroll-modal.html`);
        const modalHtml = await modalResp.text();

        const container = document.createElement('div');
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

        document.getElementById('cs-global-toggle-btn')?.addEventListener('click', () => {
            document.getElementById('cs-book-modal-wrapper')?.classList.toggle('cs-hidden');
            updateModalTitles();
        });

        document.getElementById('cs-close-book')?.addEventListener('click', () => {
            document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
        });

        document.getElementById('cs-modal-backdrop')?.addEventListener('click', () => {
            document.getElementById('cs-book-modal-wrapper')?.classList.add('cs-hidden');
        });

        document.getElementById('cs-theme-toggle')?.addEventListener('click', () => {
            const book = document.getElementById('cs-main-book');
            book.classList.toggle('cs-theme-classic');
            book.classList.toggle('cs-theme-dark');
        });

        document.querySelectorAll('#cs-nav-bookmarks .cs-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#cs-nav-bookmarks .cs-bookmark').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.cs-page').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(`cs-tab-${tabId}`)?.classList.add('active');
            });
        });

        document.getElementById('cs-lover-flip-card')?.addEventListener('click', function () {
            this.classList.toggle('flipped');
        });

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

        bindGameplayMatrixActions();
        updateModalTitles();
    }

    /**
     * 绑定各玩法多维随机抽取动作 (排列组合)
     */
    function bindGameplayMatrixActions() {
        // 未知漫游 / 街区漫步
        document.getElementById('cs-btn-roll-voyage')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('voyage');
            if (!roll) return;
            document.getElementById('cs-v-biome').textContent = roll.biome;
            document.getElementById('cs-v-race').textContent = roll.race;
            document.getElementById('cs-v-custom').textContent = roll.custom;
            document.getElementById('cs-v-bond').textContent = roll.bond;
        });

        document.getElementById('cs-btn-depart-voyage')?.addEventListener('click', () => {
            const roll = currentRolls.voyage.biome ? currentRolls.voyage : rollCategoryMatrix('voyage');
            if (roll && roll.biome) {
                const speech = `让我们启程前往【${roll.biome}】吧。`;
                const raw = `[纪行手记·漫游探索]：\n- 目标地界：【${roll.biome}】\n- 遇逢群体：【${roll.race}】\n- 当地事态：【${roll.custom}】\n- 旅伴相处：【${roll.bond}】`;
                executeSend(speech, raw, 'voyage');
            }
        });

        // 秘境迷宫 / 特色探店
        document.getElementById('cs-btn-roll-dungeon')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('dungeon');
            if (!roll) return;
            document.getElementById('cs-dg-name').textContent = roll.name;
            document.getElementById('cs-dg-trap').textContent = roll.trap;
            document.getElementById('cs-dg-reward').textContent = roll.reward;
        });
        document.getElementById('cs-btn-send-dungeon')?.addEventListener('click', () => {
            const roll = currentRolls.dungeon.name ? currentRolls.dungeon : rollCategoryMatrix('dungeon');
            if (roll && roll.name) {
                const speech = `深入探索${roll.name}。`;
                const raw = `[纪行手记·探秘探险]：\n- 探索区域：${roll.name}\n- 机关阻碍：${roll.trap}\n- 终局相守：${roll.reward}`;
                executeSend(speech, raw, 'dungeon');
            }
        });

        // 荒野野炊 / 深夜食堂
        document.getElementById('cs-btn-roll-cook')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('cook');
            if (!roll) return;
            document.getElementById('cs-ck-name').textContent = roll.dish;
            document.getElementById('cs-ck-taste').textContent = roll.taste;
            document.getElementById('cs-ck-bond').textContent = roll.bond;
        });
        document.getElementById('cs-btn-send-cook')?.addEventListener('click', () => {
            const roll = currentRolls.cook.dish ? currentRolls.cook : rollCategoryMatrix('cook');
            if (roll && roll.dish) {
                const speech = `动手支锅，尝尝新烹制的${roll.dish}。`;
                const raw = `[纪行手记·美食品尝]：\n- 美馔佳肴：${roll.dish}\n- 诱人口感：${roll.taste}\n- 围炉相伴：${roll.bond}`;
                executeSend(speech, raw, 'cook');
            }
        });

        // 突发险情 / 意外插曲
        document.getElementById('cs-btn-roll-danger')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('danger');
            if (!roll) return;
            document.getElementById('cs-dg-event').textContent = roll.event;
            document.getElementById('cs-dg-pinch').textContent = roll.pinch;
            document.getElementById('cs-dg-reaction').textContent = roll.reaction;
        });
        document.getElementById('cs-btn-send-danger')?.addEventListener('click', () => {
            const roll = currentRolls.danger.event ? currentRolls.danger : rollCategoryMatrix('danger');
            if (roll && roll.event) {
                const speech = `面对突发异变${roll.event}，我们相依突围。`;
                const raw = `[纪行手记·突发意外]：\n- 突发事态：${roll.event}\n- 贴身困境：${roll.pinch}\n- 恋人庇护：${roll.reaction}`;
                executeSend(speech, raw, 'danger');
            }
        });

        // 奇珍萌物 / 街角萌宠
        document.getElementById('cs-btn-roll-beast')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('beast');
            if (!roll) return;
            document.getElementById('cs-bt-name').textContent = roll.name;
            document.getElementById('cs-bt-habit').textContent = roll.habit;
            document.getElementById('cs-bt-bond').textContent = roll.bond;
        });
        document.getElementById('cs-btn-send-beast')?.addEventListener('click', () => {
            const roll = currentRolls.beast.name ? currentRolls.beast : rollCategoryMatrix('beast');
            if (roll && roll.name) {
                const speech = `记录萌宠【${roll.name}】入图鉴。`;
                const raw = `[纪行手记·奇珍萌宠]：\n- 生灵形态：${roll.name}\n- 灵动习性：${roll.habit}\n- 恋人破防：${roll.bond}`;
                executeSend(speech, raw, 'beast');
            }
        });

        // 营火夜谈 / 静谧夜话
        document.getElementById('cs-btn-start-camp')?.addEventListener('click', () => {
            const select = document.getElementById('cs-camp-topic-select');
            const topic = select ? select.value : '深夜私语';
            const speech = `在夜色中，聊聊关于${topic}的心里话。`;
            const raw = `[纪行手记·深夜夜话]：\n- 今夜话题：${topic}\n- 氛围契机：夜幕低垂，四野静谧，仅有彼此的体温与微光。`;
            executeSend(speech, raw, 'camp');
        });

        // 星海旧梦
        document.getElementById('cs-btn-roll-dream')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('dream') || { scene: '昔日并肩历经的风雨，如在眼前。', awake: '恋人抬手拭去你发梢夜露：“都过去了，我现在就在你身边。”' };
            document.getElementById('cs-dream-scene').textContent = roll.scene;
            document.getElementById('cs-dream-awake').textContent = roll.awake;
        });
        document.getElementById('cs-btn-send-dream')?.addEventListener('click', () => {
            const scene = document.getElementById('cs-dream-scene')?.textContent || '';
            const awake = document.getElementById('cs-dream-awake')?.textContent || '';
            const speech = `从旧日梦境中醒来，揉了揉发酸的眼角：“……我又梦见那时候的事情了。”`;
            const raw = `[纪行手记·星海旧梦]：\n- 昔年切片：${scene}\n- 醒后抚慰：${awake}`;
            executeSend(speech, raw, 'dream');
        });

        // 纪念行囊 / 纪念信物
        document.getElementById('cs-btn-roll-bag')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('souvenirs');
            if (!roll) return;
            document.getElementById('cs-souvenir-name').textContent = roll.name;
            document.getElementById('cs-souvenir-desc').textContent = roll.desc;
            document.getElementById('cs-souvenir-mem').textContent = roll.mem;
        });
        document.getElementById('cs-btn-send-bag')?.addEventListener('click', () => {
            const roll = currentRolls.souvenirs.name ? currentRolls.souvenirs : rollCategoryMatrix('souvenirs');
            if (roll && roll.name) {
                const speech = `从行囊里翻出${roll.name}，聊聊旧事。`;
                const raw = `[纪行手记·睹物旧忆]：\n- 风物信物：${roll.name}（${roll.desc}）\n- 背后记忆：${roll.mem}`;
                executeSend(speech, raw, 'souvenirs');
            }
        });

        // 拍立得
        document.getElementById('cs-btn-roll-photo')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('photos');
            if (!roll) return;
            document.getElementById('cs-ph-scene').textContent = roll.scene;
            document.getElementById('cs-ph-meta').textContent = roll.meta;
            document.getElementById('cs-ph-caption').textContent = roll.caption;
        });
        document.getElementById('cs-btn-send-photo')?.addEventListener('click', () => {
            const roll = currentRolls.photos.scene ? currentRolls.photos : rollCategoryMatrix('photos');
            if (roll && roll.scene) {
                const speech = `按动快门，定格这一瞬的记忆。`;
                const raw = `[纪行手记·旅途拍立得]：\n- 镜头场景：${roll.scene}（${roll.meta}）\n- 伴侣手记批注：${roll.caption}`;
                executeSend(speech, raw, 'photos');
            }
        });

        // 双人风尚衣箱 / 情侣穿搭
        document.getElementById('cs-btn-roll-outfit')?.addEventListener('click', () => {
            const roll = rollCategoryMatrix('outfit');
            if (!roll) return;
            document.getElementById('cs-outfit-style').textContent = roll.style;
            document.getElementById('cs-outfit-desc').textContent = roll.desc;
            document.getElementById('cs-outfit-react').textContent = roll.react;
        });
        document.getElementById('cs-btn-send-outfit')?.addEventListener('click', () => {
            const roll = currentRolls.outfit.style ? currentRolls.outfit : rollCategoryMatrix('outfit');
            if (roll && roll.style) {
                const speech = `换上${roll.style}一同出发。`;
                const raw = `[纪行手记·双人换装]：\n- 穿搭风格：${roll.style}（${roll.desc}）\n- 伴侣神态与小动作：${roll.react}`;
                executeSend(speech, raw, 'outfit');
            }
        });

        refreshCampTopics();
    }

    function refreshCampTopics() {
        const select = document.getElementById('cs-camp-topic-select');
        if (!select || !activeCategories?.camp_topics?.slots?.topic) return;
        const list = activeCategories.camp_topics.slots.topic.items || [];
        select.innerHTML = list.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    function updateCategorySelectOptions() {
        const select = document.getElementById('cs-category-select');
        if (!select || !activeCategories) return;
        const iconMap = {
            voyage: '🧭',
            dungeon: '🏛️',
            cook: '🍳',
            danger: '⚡',
            beast: '🐾',
            outfit: '👗',
            camp_topics: '⛺',
            souvenirs: '📦',
            photos: '📷'
        };
        select.innerHTML = Object.entries(activeCategories).map(([key, cat]) => {
            const icon = iconMap[key] || '📜';
            return `<option value="${key}">${icon} ${cat.name || key}</option>`;
        }).join('');
        select.value = currentCategory;
    }

    /**
     * 5. 可视化槽位词条管理面板 (Settings UI)
     */
    function setupSettingsUI() {
        const settings = getSettings();

        // 阻止设置面板内的点击事件冒泡，防止外部酒馆抽屉意外关闭
        const drawerContainer = document.getElementById('cs-settings-drawer');
        if (drawerContainer) {
            drawerContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

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

        const guideToggle = document.getElementById('cs-narrative-guide-toggle');
        if (guideToggle) {
            guideToggle.checked = settings.enableNarrativeGuide !== false;
            guideToggle.addEventListener('change', () => {
                settings.enableNarrativeGuide = guideToggle.checked;
                saveSettings();
            });
        }

        // 大类标题实时修改与同步
        const catNameInput = document.getElementById('cs-category-name-input');
        const syncCatNameInput = () => {
            if (catNameInput && activeCategories?.[currentCategory]) {
                catNameInput.value = activeCategories[currentCategory].name || '';
            }
        };
        syncCatNameInput();

        document.getElementById('cs-rename-category-btn')?.addEventListener('click', () => {
            const newName = catNameInput?.value?.trim();
            if (!newName) return;
            if (activeCategories?.[currentCategory]) {
                activeCategories[currentCategory].name = newName;
                autoUpgradeToCustom();
                saveSettings();
                updateCategorySelectOptions();
                updateModalTitles();
                renderSlotBar();
                renderPills();
                toastr.success(`大类标题已更新为：“${newName}”`);
            }
        });
        catNameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('cs-rename-category-btn')?.click();
            }
        });

        // 预设切换
        const presetSelect = document.getElementById('cs-active-preset-select');
        if (presetSelect) {
            presetSelect.value = settings.activePreset;
            presetSelect.addEventListener('change', () => {
                settings.activePreset = presetSelect.value;
                resolveActivePool();
                saveSettings();
                updateCategorySelectOptions();
                syncCatNameInput();
                updateModalTitles();
                renderSlotBar();
                renderPills();
                refreshCampTopics();
            });
        }

        // 一级大类下拉选择
        const categorySelect = document.getElementById('cs-category-select');
        updateCategorySelectOptions();
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                currentCategory = categorySelect.value;
                syncCatNameInput();
                const slots = activeCategories[currentCategory]?.slots || {};
                currentSlot = Object.keys(slots)[0] || '';
                renderSlotBar();
                renderPills();
            });
        }


        // 导出词库
        document.getElementById('cs-export-pool-btn')?.addEventListener('click', () => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeCategories, null, 2));
            const a = document.createElement('a');
            a.setAttribute('href', dataStr);
            a.setAttribute('download', `chronicle_matrix_${settings.activePreset}.json`);
            document.body.appendChild(a);
            a.click();
            a.remove();
        });

        // 导入词库
        const fileInput = document.getElementById('cs-pool-file-input');
        document.getElementById('cs-import-pool-btn')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    settings.customCategories = parsed.categories || parsed;
                    settings.activePreset = 'custom';
                    if (presetSelect) presetSelect.value = 'custom';
                    resolveActivePool();
                    saveSettings();
                    renderSlotBar();
                    renderPills();
                    refreshCampTopics();
                    toastr.success('自定义多维词库已成功导入！');
                } catch (err) {
                    toastr.error('文件格式错误，非有效 JSON 词库！');
                }
            };
            reader.readAsText(file);
        });

        // 重置词库
        document.getElementById('cs-reset-pool-btn')?.addEventListener('click', () => {
            if (confirm('确定将当前词库重置回官方默认预设吗？')) {
                if (settings.activePreset === 'custom') settings.customCategories = null;
                settings.activePreset = 'eorzea';
                if (presetSelect) presetSelect.value = 'eorzea';
                resolveActivePool();
                saveSettings();
                renderSlotBar();
                renderPills();
                refreshCampTopics();
                toastr.info('已恢复为初始默认预设。');
            }
        });

        // 添加新词条（按钮与回车触发）
        document.getElementById('cs-add-word-btn')?.addEventListener('click', submitAddWord);
        document.getElementById('cs-new-word-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitAddWord();
        });

        const catSelInit = document.getElementById('cs-category-select');
        if (catSelInit) catSelInit.value = currentCategory;
        renderSlotBar();
        renderPills();
    }

    /**
     * 渲染二级小类（槽位 Slot）按钮栏
     */
    function renderSlotBar() {
        const container = document.getElementById('cs-slots-container');
        if (!container || !activeCategories || !activeCategories[currentCategory]) return;
        const slots = activeCategories[currentCategory].slots || {};

        container.innerHTML = Object.entries(slots).map(([slotKey, slotObj]) => `
            <button type="button" class="cs-slot-btn ${slotKey === currentSlot ? 'active' : ''}" data-slot="${slotKey}">
                ${slotObj.name}
            </button>
        `).join('');

        container.querySelectorAll('.cs-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.cs-slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSlot = btn.getAttribute('data-slot');
                renderPills();
            });
        });
    }

    /**
     * 渲染当前槽位下的词条胶囊 (Tag Pills)
     */
    function renderPills() {
        const pillsContainer = document.getElementById('cs-pills-container');
        const titleEl = document.getElementById('cs-current-slot-title');
        const countBadge = document.getElementById('cs-slot-count');
        const inputEl = document.getElementById('cs-new-word-input');
        if (!pillsContainer || !activeCategories) return;

        const slotObj = activeCategories[currentCategory]?.slots?.[currentSlot];
        if (!slotObj) {
            pillsContainer.innerHTML = '<div style="opacity:0.6;font-size:11.5px;padding:8px;">暂无可管理的槽位</div>';
            return;
        }

        if (titleEl) titleEl.textContent = `${slotObj.name} · 词条管理`;
        const items = slotObj.items || [];
        if (countBadge) countBadge.textContent = `${items.length} 个`;
        if (inputEl) inputEl.placeholder = `输入新的【${slotObj.name}】按回车添加...`;

        if (items.length === 0) {
            pillsContainer.innerHTML = '<div style="opacity:0.6;font-size:11.5px;padding:8px;">此槽位下暂无词条，请在下方直接输入添加。</div>';
            return;
        }

        pillsContainer.innerHTML = items.map((word, idx) => `
            <div class="cs-word-pill">
                <span>${word}</span>
                <span class="cs-pill-del" onclick="window.csDeleteSingleWord(${idx})" title="删除此词">×</span>
            </div>
        `).join('');
    }

    /**
     * 单个词条删除与添加
     */
    window.csDeleteSingleWord = function (idx) {
        const slotObj = activeCategories?.[currentCategory]?.slots?.[currentSlot];
        if (!slotObj || !Array.isArray(slotObj.items)) return;
        slotObj.items.splice(idx, 1);

        autoUpgradeToCustom();
        saveSettings();
        renderPills();
        refreshCampTopics();
    };

    function submitAddWord() {
        const inputEl = document.getElementById('cs-new-word-input');
        const word = inputEl?.value?.trim();
        if (!word) return;

        const slotObj = activeCategories?.[currentCategory]?.slots?.[currentSlot];
        if (!slotObj) return;
        if (!Array.isArray(slotObj.items)) slotObj.items = [];

        slotObj.items.push(word);
        autoUpgradeToCustom();
        saveSettings();
        renderPills();
        refreshCampTopics();

        inputEl.value = '';
        toastr.success(`已添加：“${word}”`);
    }

    function autoUpgradeToCustom() {
        const settings = getSettings();
        if (settings.activePreset !== 'custom') {
            settings.customCategories = JSON.parse(JSON.stringify(activeCategories));
            settings.activePreset = 'custom';
            const sel = document.getElementById('cs-active-preset-select');
            if (sel) sel.value = 'custom';
        }
    }

    /**
     * 初始化主入口
     */
    jQuery(async function () {
        console.log('[ChronicleScroll] 纪行手记扩展正在初始化...');
        await loadBuiltinPools();
        updateExtensionPrompt();
        await mountModal();

        const context = SillyTavern.getContext();
        const eventSource = context.eventSource;
        const eventTypes = context.eventTypes;

        if (eventSource && eventTypes) {
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (msgId) => onCharacterMessageRendered(msgId));
            eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, () => updateExtensionPrompt());
        }

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
