export const runtime = "nodejs";

const requiredFields = ["recipientRelation", "recipientName", "senderRelation", "senderName", "message"];

export async function POST(request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let input;
  try {
    input = await request.json();
  } catch {
    console.error("[qiaopi:generate-letter]", requestId, "invalid-json");
    return Response.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  console.info("[qiaopi:generate-letter]", requestId, "request", {
    hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
    // model: "deepseek-v4-pro",
    model: "deepseek-v4-flash",
    recipientRelation: input?.recipientRelation,
    senderRelation: input?.senderRelation,
    tone: input?.tone,
    length: input?.length,
    attachmentType: input?.attachmentType,
  });

  const missingField = requiredFields.find((field) => !String(input?.[field] || "").trim());
  if (missingField) {
    console.warn("[qiaopi:generate-letter]", requestId, "missing-field", missingField);
    return Response.json({ error: `缺少必要字段：${missingField}` }, { status: 400 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn("[qiaopi:generate-letter]", requestId, "fallback:no-api-key", {
      durationMs: Date.now() - startedAt,
    });
    return Response.json(withDebug(createFallbackLetter(input), {
      requestId,
      source: "fallback:no-api-key",
      hasApiKey: false,
      durationMs: Date.now() - startedAt,
    }));
  }

  try {
    console.info("[qiaopi:generate-letter]", requestId, "deepseek:start");
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        // model: "deepseek-v4-pro",
        model: "deepseek-v4-flash",
        thinking: { type: "enabled" },
        reasoning_effort: "high",
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: JSON.stringify(normalizeInput(input)) },
        ],
      }),
    });

    const payload = await response.json();
    console.info("[qiaopi:generate-letter]", requestId, "deepseek:response", {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      hasChoices: Array.isArray(payload?.choices),
      errorMessage: payload?.error?.message,
    });
    if (!response.ok) {
      return Response.json(
        { error: payload?.error?.message || "DeepSeek API 调用失败。" },
        { status: 502 },
      );
    }

    const rawContent = payload?.choices?.[0]?.message?.content;
    console.info("[qiaopi:generate-letter]", requestId, "deepseek:content", {
      contentLength: rawContent?.length || 0,
    });
    const generated = JSON.parse(rawContent);
    return Response.json(withDebug(sanitizeGeneratedLetter(generated, input), {
      requestId,
      source: "deepseek",
      hasApiKey: true,
      status: response.status,
      durationMs: Date.now() - startedAt,
    }));
  } catch (error) {
    console.error("[qiaopi:generate-letter]", requestId, "error", {
      message: error?.message,
      durationMs: Date.now() - startedAt,
    });
    return Response.json(
      { error: error?.message || "生成失败，请稍后再试。" },
      { status: 500 },
    );
  }
}

function withDebug(letter, debug) {
  if (process.env.NODE_ENV === "production") return letter;
  return {
    ...letter,
    _debug: debug,
  };
}

function buildSystemPrompt() {
  return [
    "你是一位熟悉侨批、银信、华侨家书文体的代笔先生。",
    "你的任务是把用户的现代白话改写成一封繁体中文侨批式家书，并生成信封字段。",
    "风格要求：70% 朴素真实，30% 文学润色；语言克制、家常、郑重，不要过度古风。",
    "不要写成诗、散文、鸡汤或现代营销文案；不要编造具体历史事件、真实机构背书或无法确认的史实。",
    "必须使用繁体中文。可以使用展信佳、謹上、隨信附上、聊充家用、伏惟珍重等旧式书信表达。",
    "正文要自然包含报平安、问候、牵挂、随信物用途。根据用户语气决定是否出现歉意、劝慰或托付。",
    "移动端信纸空间有限，正文必须短：greeting 不超过 12 个汉字，body 只给 2 段，每段 24 到 34 个汉字，postscript 不超过 18 个汉字。",
    "只返回合法 JSON，不要 Markdown，不要解释。",
    "JSON 结构必须为：",
    JSON.stringify({
      envelope: {
        title: "僑批",
        recipientLine: "收信人稱謂",
        senderLine: "寄信人稱謂",
        sideMotto: "題簽短句",
        bureauName: "銀信局名",
        serialNo: "文書編號",
      },
      letter: {
        title: "家書",
        greeting: "稱謂展信佳：",
        body: ["兩段短正文"],
        postscript: "隨信附上……",
        signature: "署名",
        date: "中文日期",
      },
      plainText: "完整可复制文本",
      shareTitle: "一封漂洋過海的信",
      safetyNote: "本信為生成式創作，非真實歷史文書。",
    }),
  ].join("\n");
}

function normalizeInput(input) {
  return {
    recipientRelation: String(input.recipientRelation || "").slice(0, 12),
    recipientName: String(input.recipientName || "").slice(0, 24),
    senderRelation: String(input.senderRelation || "").slice(0, 12),
    senderName: String(input.senderName || "").slice(0, 24),
    fromPlace: String(input.fromPlace || "").slice(0, 40),
    toPlace: String(input.toPlace || "").slice(0, 40),
    tone: String(input.tone || "").slice(0, 16),
    length: String(input.length || "普通").slice(0, 8),
    attachmentType: String(input.attachmentType || "").slice(0, 16),
    attachment: String(input.attachment || "").slice(0, 80),
    message: String(input.message || "").slice(0, 1000),
  };
}

function sanitizeGeneratedLetter(generated, input) {
  const fallback = createFallbackLetter(input);
  const envelope = generated?.envelope || {};
  const letter = generated?.letter || {};
  const body = Array.isArray(letter.body) && letter.body.length ? letter.body : fallback.letter.body;

  return {
    envelope: {
      title: String(envelope.title || fallback.envelope.title),
      recipientLine: String(envelope.recipientLine || fallback.envelope.recipientLine),
      senderLine: String(envelope.senderLine || fallback.envelope.senderLine),
      sideMotto: String(envelope.sideMotto || fallback.envelope.sideMotto),
      bureauName: String(envelope.bureauName || fallback.envelope.bureauName),
      serialNo: String(envelope.serialNo || fallback.envelope.serialNo),
    },
    letter: {
      title: String(letter.title || fallback.letter.title),
      greeting: limitText(letter.greeting || fallback.letter.greeting, 14),
      body: body.slice(0, 2).map((paragraph) => limitText(paragraph, 36)),
      postscript: limitText(letter.postscript || fallback.letter.postscript, 20),
      signature: String(letter.signature || fallback.letter.signature),
      date: String(letter.date || fallback.letter.date),
    },
    plainText: String(generated?.plainText || fallback.plainText),
    shareTitle: String(generated?.shareTitle || fallback.shareTitle),
    safetyNote: String(generated?.safetyNote || fallback.safetyNote),
  };
}

function createFallbackLetter(input) {
  const data = normalizeInput(input);
  const recipientLine = `${data.recipientName}${relationSuffix(data.recipientRelation)}親啟`;
  const senderLine = `${data.senderName}寄`;
  const attachment = data.attachment || defaultAttachment(data.attachmentType);
  const date = formatChineseDate(new Date());
  const body = buildFallbackBody(data);

  const plainText = [
    `${recipientLine}`,
    "",
    `${data.recipientName}${relationSuffix(data.recipientRelation)}展信佳：`,
    ...body,
    `隨信附上${attachment}。`,
    "",
    `${data.senderRelation} ${data.senderName} 謹上`,
    date,
  ].join("\n");

  return {
    envelope: {
      title: "僑批",
      recipientLine,
      senderLine,
      sideMotto: "紙短情長，伏惟珍重",
      bureauName: `${data.fromPlace || "南洋"}銀信局`,
      serialNo: "海字第貳佰零柒號",
    },
    letter: {
      title: "家書",
      greeting: `${data.recipientName}${relationSuffix(data.recipientRelation)}展信佳：`,
      body,
      postscript: `隨信附上${attachment}。`,
      signature: `${data.senderRelation} ${data.senderName} 謹上`,
      date,
    },
    plainText,
    shareTitle: "一封漂洋過海的信",
    safetyNote: "本信為生成式創作，非真實歷史文書。",
  };
}

function defaultAttachment(type) {
  const map = {
    家用: "薄資若干，聊充家用",
    學費: "學費若干，望先付學塾",
    藥費: "藥費若干，望先調養身體",
    衣物: "衣料一包，望裁作冬衣",
    米糧: "米糧錢若干，望補家中用度",
    銀元: "銀元若干，聊充家用",
    物件: "家用物件一份",
    其他: "另附一份家中所需",
  };
  return map[type] || "薄資若干，聊充家用";
}

function buildFallbackBody(data) {
  return [
    `別後日久，我在外尚算平安，衣食雖不寬，心中常記家中情形。`,
    `海路迢迢，紙短難盡。望你保重身體，有急用先取隨信所附支應。`,
  ];
}

function limitText(value, maxLength) {
  return String(value || "").replace(/\s+/g, "").slice(0, maxLength);
}

function relationSuffix(relation) {
  const map = {
    妻: "吾妻",
    夫: "吾夫",
    母: "慈母",
    父: "嚴父",
    子: "吾兒",
    女: "吾女",
    兄: "兄長",
    弟: "賢弟",
    姊: "阿姊",
    妹: "阿妹",
    友人: "仁兄",
    族親: "族親",
  };
  return map[relation] || relation || "親人";
}

function formatChineseDate(date) {
  const digits = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const year = String(date.getFullYear()).split("").map((digit) => digits[Number(digit)]).join("");
  return `${year}年${toChineseNumber(date.getMonth() + 1)}月${toChineseNumber(date.getDate())}日`;
}

function toChineseNumber(number) {
  const units = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (number <= 10) return units[number];
  if (number < 20) return `十${units[number - 10]}`;
  const ten = Math.floor(number / 10);
  const one = number % 10;
  return `${units[ten]}十${one ? units[one] : ""}`;
}
