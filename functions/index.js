const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");

admin.initializeApp();

const db = admin.firestore();

function getPreviousMonthRangeBangkok(now = new Date()) {
  const bangkokNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

  const year = bangkokNow.getFullYear();
  const month = bangkokNow.getMonth();

  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);

  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return { start, end, monthKey };
}

function getLineUserId(userId, userData) {
  return (
    userData.lineUserId ||
    userData.lineId ||
    userData.line_user_id ||
    userData.uid ||
    (String(userId).startsWith("U") ? userId : null)
  );
}

async function pushLineMessage(lineUserId, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    logger.warn("LINE_CHANNEL_ACCESS_TOKEN not set, skip push message");
    return;
  }

  if (!lineUserId) {
    logger.warn("Missing LINE userId, skip push message");
    return;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("LINE push failed", { status: res.status, text });
  }
}

function topPrizeText(rank) {
  if (rank === 1) return "อันดับ 1 รับเสื้อ Ranking สีทอง";
  if (rank === 2) return "อันดับ 2 รับเสื้อ Ranking สีแดง";
  if (rank === 3) return "อันดับ 3 รับเสื้อ Ranking สีเขียว";
  return "รับเสื้อ Ranking";
}

function buildRewardMessage({ displayName, monthKey, points, rank, rewardType }) {
  if (rewardType === "ranking_shirt") {
    return [
      {
        type: "flex",
        altText: "ยินดีด้วย คุณได้รับรางวัล Top Ranking G2 Snooker",
        contents: {
          type: "bubble",
          size: "mega",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "🏆 G2 SNOOKER",
                weight: "bold",
                size: "xl",
                align: "center",
                color: "#D4AF37"
              },
              {
                type: "text",
                text: "ยินดีด้วย!",
                weight: "bold",
                size: "xxl",
                align: "center"
              },
              {
                type: "text",
                text: displayName || "ลูกค้า VIP",
                weight: "bold",
                size: "lg",
                align: "center",
                wrap: true
              },
              {
                type: "separator",
                margin: "md"
              },
              {
                type: "text",
                text: `คุณคือ Top ${rank} ประจำเดือน ${monthKey}`,
                weight: "bold",
                size: "lg",
                align: "center",
                wrap: true
              },
              {
                type: "text",
                text: `คะแนนสะสม: ${points} แต้ม`,
                size: "md",
                align: "center",
                wrap: true
              },
              {
                type: "text",
                text: topPrizeText(rank),
                size: "md",
                align: "center",
                wrap: true
              },
              {
                type: "text",
                text: "กรุณาติดต่อรับเสื้อ Ranking ได้ที่ร้าน G2 Snooker",
                size: "sm",
                align: "center",
                wrap: true,
                color: "#666666"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "ให้พนักงานสแกน QR สมาชิกเพื่อกดใช้สิทธิ์",
                size: "xs",
                align: "center",
                wrap: true,
                color: "#999999"
              }
            ]
          }
        }
      }
    ];
  }

  return [
    {
      type: "flex",
      altText: "คุณได้รับสิทธิ์ส่วนลด 10% จาก G2 Snooker",
      contents: {
        type: "bubble",
        size: "mega",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: "🎉 G2 SNOOKER",
              weight: "bold",
              size: "xl",
              align: "center",
              color: "#111111"
            },
            {
              type: "text",
              text: "ไม่ติด Top 3 ก็รับสิทธิ์ได้!",
              weight: "bold",
              size: "lg",
              align: "center",
              wrap: true
            },
            {
              type: "text",
              text: displayName || "ลูกค้า VIP",
              weight: "bold",
              size: "lg",
              align: "center",
              wrap: true
            },
            {
              type: "separator",
              margin: "md"
            },
            {
              type: "text",
              text: `คุณมีคะแนนสะสม ${points} แต้ม ในเดือน ${monthKey}`,
              size: "md",
              align: "center",
              wrap: true
            },
            {
              type: "text",
              text: "รับสิทธิ์ส่วนลดค่าชั่วโมง 10%",
              weight: "bold",
              size: "xl",
              align: "center",
              wrap: true,
              color: "#0B8F3A"
            },
            {
              type: "text",
              text: "ใช้ได้ 1 บิล ในเดือนถัดไป",
              size: "sm",
              align: "center",
              wrap: true,
              color: "#666666"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "ให้พนักงานสแกน QR สมาชิกเพื่อกดใช้สิทธิ์",
              size: "xs",
              align: "center",
              wrap: true,
              color: "#999999"
            }
          ]
        }
      }
    }
  ];
}

async function calculateMonthlyRanking(start, end) {
  const usersSnap = await db.collection("users").get();

  const users = new Map();

  usersSnap.forEach((doc) => {
    const data = doc.data() || {};
    const role = data.role || "member";

    if (role === "staff" || role === "admin") return;

    users.set(doc.id, {
      userId: doc.id,
      ...data,
      points: 0,
    });
  });

  const txSnap = await db
    .collection("pointTransactions")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("timestamp", "<", admin.firestore.Timestamp.fromDate(end))
    .get();

  txSnap.forEach((doc) => {
    const tx = doc.data() || {};
    const userId = tx.userId || tx.memberId || tx.uid;
    const points = Number(tx.points || tx.point || 0);

    if (!userId || !users.has(userId)) return;
    if (!Number.isFinite(points) || points <= 0) return;

    users.get(userId).points += points;
  });

  let ranking = Array.from(users.values()).filter((u) => u.points > 0);

  if (ranking.length === 0) {
    ranking = Array.from(users.values())
      .map((u) => ({
        ...u,
        points: Number(u.monthlyPoints || 0),
      }))
      .filter((u) => u.points > 0);
  }

  ranking.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return aTime - bTime;
  });

  return ranking;
}

async function runMonthlyAwards() {
  const { start, end, monthKey } = getPreviousMonthRangeBangkok();

  const existing = await db
    .collection("monthlyRewardRuns")
    .doc(monthKey)
    .get();

  if (existing.exists) {
    logger.info("Monthly awards already generated", { monthKey });
    return { monthKey, skipped: true };
  }

  const ranking = await calculateMonthlyRanking(start, end);

  const top3 = ranking.slice(0, 3);
  const top3Ids = new Set(top3.map((u) => u.userId));

  const discountUsers = ranking.filter(
    (u) => !top3Ids.has(u.userId) && Number(u.points) >= 15
  );

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const runRef = db.collection("monthlyRewardRuns").doc(monthKey);
  batch.set(runRef, {
    monthKey,
    startAt: admin.firestore.Timestamp.fromDate(start),
    endAt: admin.firestore.Timestamp.fromDate(end),
    top3Count: top3.length,
    discountCount: discountUsers.length,
    createdAt: now,
  });

  const rewardItems = [];

  top3.forEach((user, index) => {
    const rank = index + 1;
    const rewardId = `${monthKey}_${user.userId}_top${rank}`;
    const rewardRef = db.collection("monthlyRewards").doc(rewardId);

    const reward = {
      rewardId,
      userId: user.userId,
      monthKey,
      rewardType: "ranking_shirt",
      rank,
      points: Number(user.points || 0),
      title: `Top ${rank} เสื้อ Ranking`,
      description: topPrizeText(rank),
      status: "active",
      usedAt: null,
      usedBy: null,
      createdAt: now,
    };

    batch.set(rewardRef, reward);
    rewardItems.push({ user, reward });
  });

  discountUsers.forEach((user) => {
    const rewardId = `${monthKey}_${user.userId}_discount10`;
    const rewardRef = db.collection("monthlyRewards").doc(rewardId);

    const reward = {
      rewardId,
      userId: user.userId,
      monthKey,
      rewardType: "discount_10",
      rank: null,
      points: Number(user.points || 0),
      title: "ส่วนลดค่าชั่วโมง 10%",
      description: "ใช้ได้ 1 บิล ในเดือนถัดไป",
      status: "active",
      usedAt: null,
      usedBy: null,
      createdAt: now,
    };

    batch.set(rewardRef, reward);
    rewardItems.push({ user, reward });
  });

  await batch.commit();

  for (const item of rewardItems) {
    const user = item.user;
    const reward = item.reward;

    const lineUserId = getLineUserId(user.userId, user);
    const displayName = user.displayName || user.name || user.fullName || "ลูกค้า VIP";

    await pushLineMessage(
      lineUserId,
      buildRewardMessage({
        displayName,
        monthKey,
        points: reward.points,
        rank: reward.rank,
        rewardType: reward.rewardType,
      })
    );
  }

  logger.info("Monthly awards generated", {
    monthKey,
    top3Count: top3.length,
    discountCount: discountUsers.length,
  });

  return {
    monthKey,
    top3Count: top3.length,
    discountCount: discountUsers.length,
  };
}

exports.monthlyAwards = onSchedule(
  {
    schedule: "0 9 1 * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  },
  async () => {
    return runMonthlyAwards();
  }
);

exports.testMonthlyAwards = onCall(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  },
  async (request) => {
    const uid = request.auth && request.auth.uid;

    if (!uid) {
      throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อน");
    }

    const userDoc = await db.collection("users").doc(uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;

    if (role !== "admin") {
      throw new HttpsError("permission-denied", "เฉพาะแอดมินเท่านั้น");
    }

    return runMonthlyAwards();
  }
);

exports.redeemMonthlyReward = onCall(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    const rewardId = request.data && request.data.rewardId;

    if (!uid) {
      throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อน");
    }

    if (!rewardId) {
      throw new HttpsError("invalid-argument", "missing rewardId");
    }

    const staffDoc = await db.collection("users").doc(uid).get();
    const staffRole = staffDoc.exists ? staffDoc.data().role : null;

    if (staffRole !== "staff" && staffRole !== "admin") {
      throw new HttpsError("permission-denied", "เฉพาะพนักงานหรือแอดมินเท่านั้น");
    }

    const rewardRef = db.collection("monthlyRewards").doc(rewardId);

    await db.runTransaction(async (tx) => {
      const rewardDoc = await tx.get(rewardRef);

      if (!rewardDoc.exists) {
        throw new HttpsError("not-found", "ไม่พบสิทธิ์นี้");
      }

      const reward = rewardDoc.data();

      if (reward.status !== "active") {
        throw new HttpsError("failed-precondition", "สิทธิ์นี้ถูกใช้ไปแล้ว");
      }

      tx.update(rewardRef, {
        status: "used",
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedBy: uid,
      });
    });

    return {
      ok: true,
      rewardId,
    };
  }
);


const REWARD_STAFF_KEY = defineSecret("REWARD_STAFF_KEY");

function checkRewardStaffKey(req) {
  const inputKey =
    req.query.key ||
    req.headers["x-staff-key"] ||
    (req.body && req.body.key);

  const realKey = process.env.REWARD_STAFF_KEY;

  return Boolean(realKey && inputKey && String(inputKey) === String(realKey));
}

async function findUserByMemberCode(code) {
  const raw = String(code || "").trim();

  if (!raw) return null;

  const directDoc = await db.collection("users").doc(raw).get();
  if (directDoc.exists) {
    return {
      id: directDoc.id,
      data: directDoc.data() || {},
    };
  }

  const fields = ["qrToken", "memberId", "lineUserId", "uid"];

  for (const field of fields) {
    const snap = await db.collection("users").where(field, "==", raw).limit(1).get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      return {
        id: doc.id,
        data: doc.data() || {},
      };
    }
  }

  return null;
}

exports.staffRewardPage = require("firebase-functions/v2/https").onRequest(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [REWARD_STAFF_KEY],
  },
  async (req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8");

    res.status(200).send(`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>G2 Snooker - ใช้สิทธิ์รางวัล</title>
  <style>
    body{font-family:Arial,sans-serif;background:#111;color:#fff;margin:0;padding:18px}
    .card{max-width:520px;margin:0 auto;background:#1f1f1f;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{text-align:center;font-size:24px;margin:6px 0 18px}
    label{display:block;color:#bbb;margin:14px 0 6px}
    input{width:100%;box-sizing:border-box;border:1px solid #333;background:#0b0b0b;color:#fff;border-radius:12px;padding:14px;font-size:18px}
    button{width:100%;border:0;border-radius:12px;padding:14px;font-weight:bold;font-size:18px;margin-top:12px;cursor:pointer}
    .primary{background:#d4af37;color:#111}
    .danger{background:#d83131;color:#fff}
    .muted{color:#aaa;font-size:13px;line-height:1.5}
    .reward{border:1px solid #444;background:#151515;border-radius:14px;padding:14px;margin-top:12px}
    .reward-title{font-size:20px;font-weight:bold}
    .ok{color:#36d06f}
    .err{color:#ff6969}
    .pill{display:inline-block;background:#333;border-radius:99px;padding:4px 10px;font-size:13px;margin-top:6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>🏆 G2 Snooker<br>ใช้สิทธิ์รางวัล</h1>

    <label>รหัสพนักงาน</label>
    <input id="key" type="password" placeholder="กรอกรหัสพนักงาน">

    <label>สแกน QR / กรอกรหัสลูกค้า</label>
    <input id="code" placeholder="qrToken / memberId / userId">

    <button class="primary" onclick="lookup()">ค้นหาสิทธิ์</button>

    <p class="muted">
      ใช้สำหรับ Top 3 รับเสื้อ Ranking และลูกค้าที่มี 15 แต้มขึ้นไป รับส่วนลด 10%
    </p>

    <div id="result"></div>
  </div>

<script>
const $ = (id) => document.getElementById(id);

function saveKey() {
  localStorage.setItem("g2RewardStaffKey", $("key").value.trim());
}

$("key").value = localStorage.getItem("g2RewardStaffKey") || "";

async function lookup() {
  saveKey();

  const key = $("key").value.trim();
  const code = $("code").value.trim();
  const result = $("result");

  result.innerHTML = "";

  if (!key || !code) {
    result.innerHTML = '<p class="err">กรุณากรอกรหัสพนักงานและรหัสลูกค้า</p>';
    return;
  }

  result.innerHTML = '<p class="muted">กำลังค้นหา...</p>';

  try {
    const r = await fetch("/lookupMonthlyRewards?key=" + encodeURIComponent(key) + "&code=" + encodeURIComponent(code));
    const d = await r.json();

    if (!r.ok || !d.ok) {
      result.innerHTML = '<p class="err">' + (d.message || "ค้นหาไม่สำเร็จ") + '</p>';
      return;
    }

    if (!d.rewards.length) {
      result.innerHTML =
        '<p class="ok">พบลูกค้า: ' + escapeHtml(d.member.displayName || d.member.id) + '</p>' +
        '<p class="muted">ยังไม่มีสิทธิ์ที่ใช้งานได้ หรือสิทธิ์ถูกใช้ไปแล้ว</p>';
      return;
    }

    result.innerHTML =
      '<p class="ok">พบลูกค้า: ' + escapeHtml(d.member.displayName || d.member.id) + '</p>' +
      d.rewards.map(renderReward).join("");

  } catch (e) {
    result.innerHTML = '<p class="err">เกิดข้อผิดพลาด: ' + escapeHtml(e.message) + '</p>';
  }
}

function renderReward(r) {
  const typeText = r.rewardType === "ranking_shirt" ? "เสื้อ Ranking" : "ส่วนลด 10%";
  const rankText = r.rank ? "Top " + r.rank : "";
  return \`
    <div class="reward">
      <div class="reward-title">\${escapeHtml(r.title || typeText)}</div>
      <div class="pill">\${escapeHtml(typeText)} \${escapeHtml(rankText)}</div>
      <p>เดือน: \${escapeHtml(r.monthKey || "-")}</p>
      <p>คะแนน: \${Number(r.points || 0)} แต้ม</p>
      <p class="muted">\${escapeHtml(r.description || "")}</p>
      <button class="danger" onclick="redeem('\${escapeAttr(r.rewardId)}')">ยืนยันใช้สิทธิ์นี้</button>
    </div>
  \`;
}

async function redeem(rewardId) {
  saveKey();

  if (!confirm("ยืนยันใช้สิทธิ์นี้? หลังใช้แล้วจะใช้ซ้ำไม่ได้")) return;

  const key = $("key").value.trim();

  try {
    const r = await fetch("/redeemMonthlyRewardHttp", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ key, rewardId })
    });

    const d = await r.json();

    if (!r.ok || !d.ok) {
      alert(d.message || "ใช้สิทธิ์ไม่สำเร็จ");
      return;
    }

    alert("ใช้สิทธิ์สำเร็จ");
    lookup();

  } catch (e) {
    alert("เกิดข้อผิดพลาด: " + e.message);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function escapeAttr(s) {
  return String(s || "").replace(/'/g, "\\\\'");
}
</script>
</body>
</html>`);
  }
);

exports.lookupMonthlyRewards = require("firebase-functions/v2/https").onRequest(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [REWARD_STAFF_KEY],
  },
  async (req, res) => {
    try {
      if (!checkRewardStaffKey(req)) {
        res.status(403).json({ ok: false, message: "รหัสพนักงานไม่ถูกต้อง" });
        return;
      }

      const code = req.query.code || (req.body && req.body.code);
      const member = await findUserByMemberCode(code);

      if (!member) {
        res.status(404).json({ ok: false, message: "ไม่พบลูกค้า" });
        return;
      }

      const rewardsSnap = await db
        .collection("monthlyRewards")
        .where("userId", "==", member.id)
        .where("status", "==", "active")
        .get();

      const rewards = [];

      rewardsSnap.forEach((doc) => {
        const data = doc.data() || {};
        rewards.push({
          rewardId: doc.id,
          rewardType: data.rewardType || "",
          title: data.title || "",
          description: data.description || "",
          monthKey: data.monthKey || "",
          points: data.points || 0,
          rank: data.rank || null,
          status: data.status || "",
        });
      });

      rewards.sort((a, b) => {
        if (a.rewardType === "ranking_shirt" && b.rewardType !== "ranking_shirt") return -1;
        if (a.rewardType !== "ranking_shirt" && b.rewardType === "ranking_shirt") return 1;
        return String(a.rewardId).localeCompare(String(b.rewardId));
      });

      res.status(200).json({
        ok: true,
        member: {
          id: member.id,
          displayName:
            member.data.displayName ||
            member.data.name ||
            member.data.fullName ||
            member.data.memberId ||
            member.id,
        },
        rewards,
      });
    } catch (e) {
      res.status(500).json({ ok: false, message: e.message || "server error" });
    }
  }
);

exports.redeemMonthlyRewardHttp = require("firebase-functions/v2/https").onRequest(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [REWARD_STAFF_KEY],
  },
  async (req, res) => {
    try {
      if (!checkRewardStaffKey(req)) {
        res.status(403).json({ ok: false, message: "รหัสพนักงานไม่ถูกต้อง" });
        return;
      }

      const rewardId = (req.body && req.body.rewardId) || req.query.rewardId;

      if (!rewardId) {
        res.status(400).json({ ok: false, message: "missing rewardId" });
        return;
      }

      const rewardRef = db.collection("monthlyRewards").doc(String(rewardId));

      await db.runTransaction(async (tx) => {
        const rewardDoc = await tx.get(rewardRef);

        if (!rewardDoc.exists) {
          throw new Error("ไม่พบสิทธิ์นี้");
        }

        const reward = rewardDoc.data() || {};

        if (reward.status !== "active") {
          throw new Error("สิทธิ์นี้ถูกใช้ไปแล้ว");
        }

        tx.update(rewardRef, {
          status: "used",
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          usedBy: "staff_reward_page",
        });
      });

      res.status(200).json({ ok: true, rewardId });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message || "redeem error" });
    }
  }
);



function g2ScanNormalizeCode(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  try {
    const u = new URL(raw);
    const keys = ["qrToken", "token", "code", "memberId", "uid", "userId", "id"];
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v) return String(v).trim();
    }

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length) return decodeURIComponent(parts[parts.length - 1]).trim();
  } catch (e) {}

  return raw;
}

async function g2ScanFindUserByCode(code) {
  const raw = g2ScanNormalizeCode(code);
  if (!raw) return null;

  const directDoc = await db.collection("users").doc(raw).get();
  if (directDoc.exists) {
    return { id: directDoc.id, data: directDoc.data() || {} };
  }

  const fields = ["qrToken", "memberId", "lineUserId", "lineId", "uid", "userId"];
  for (const field of fields) {
    const snap = await db.collection("users").where(field, "==", raw).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, data: doc.data() || {} };
    }
  }

  return null;
}

exports.staffRewardScanPage = require("firebase-functions/v2/https").onRequest(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [REWARD_STAFF_KEY],
  },
  async (req, res) => {
    const route = (req.path || "/").replace(/\/+$/, "") || "/";

    function checkKey() {
      const inputKey =
        req.query.key ||
        req.headers["x-staff-key"] ||
        (req.body && req.body.key);

      const realKey = process.env.REWARD_STAFF_KEY;
      return Boolean(realKey && inputKey && String(inputKey) === String(realKey));
    }

    if (route === "/lookup") {
      try {
        if (!checkKey()) {
          res.status(403).json({ ok: false, message: "รหัสพนักงานไม่ถูกต้อง" });
          return;
        }

        const code = req.query.code || (req.body && req.body.code);
        const member = await g2ScanFindUserByCode(code);

        if (!member) {
          res.status(404).json({ ok: false, message: "ไม่พบลูกค้า / QR ไม่ตรงกับข้อมูลสมาชิก" });
          return;
        }

        const rewardsSnap = await db
          .collection("monthlyRewards")
          .where("userId", "==", member.id)
          .where("status", "==", "active")
          .get();

        const rewards = [];
        rewardsSnap.forEach((doc) => {
          const data = doc.data() || {};
          rewards.push({
            rewardId: doc.id,
            rewardType: data.rewardType || "",
            title: data.title || "",
            description: data.description || "",
            monthKey: data.monthKey || "",
            points: data.points || 0,
            rank: data.rank || null,
            status: data.status || "",
          });
        });

        rewards.sort((a, b) => {
          if (a.rewardType === "ranking_shirt" && b.rewardType !== "ranking_shirt") return -1;
          if (a.rewardType !== "ranking_shirt" && b.rewardType === "ranking_shirt") return 1;
          return String(a.rewardId).localeCompare(String(b.rewardId));
        });

        res.status(200).json({
          ok: true,
          member: {
            id: member.id,
            displayName:
              member.data.displayName ||
              member.data.name ||
              member.data.fullName ||
              member.data.memberId ||
              member.id,
          },
          rewards,
        });
        return;
      } catch (e) {
        res.status(500).json({ ok: false, message: e.message || "server error" });
        return;
      }
    }

    if (route === "/redeem") {
      try {
        if (!checkKey()) {
          res.status(403).json({ ok: false, message: "รหัสพนักงานไม่ถูกต้อง" });
          return;
        }

        const rewardId = (req.body && req.body.rewardId) || req.query.rewardId;

        if (!rewardId) {
          res.status(400).json({ ok: false, message: "missing rewardId" });
          return;
        }

        const rewardRef = db.collection("monthlyRewards").doc(String(rewardId));

        await db.runTransaction(async (tx) => {
          const rewardDoc = await tx.get(rewardRef);

          if (!rewardDoc.exists) {
            throw new Error("ไม่พบสิทธิ์นี้");
          }

          const reward = rewardDoc.data() || {};

          if (reward.status !== "active") {
            throw new Error("สิทธิ์นี้ถูกใช้ไปแล้ว");
          }

          tx.update(rewardRef, {
            status: "used",
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            usedBy: "staff_reward_scan_page",
          });
        });

        res.status(200).json({ ok: true, rewardId });
        return;
      } catch (e) {
        res.status(400).json({ ok: false, message: e.message || "redeem error" });
        return;
      }
    }

    res.set("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>G2 Snooker - สแกนใช้สิทธิ์</title>
  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
  <style>
    body{font-family:Arial,sans-serif;background:#111;color:#fff;margin:0;padding:18px}
    .card{max-width:520px;margin:0 auto;background:#1f1f1f;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{text-align:center;font-size:24px;margin:6px 0 18px}
    label{display:block;color:#bbb;margin:14px 0 6px}
    input{width:100%;box-sizing:border-box;border:1px solid #333;background:#0b0b0b;color:#fff;border-radius:12px;padding:14px;font-size:18px}
    button{width:100%;border:0;border-radius:12px;padding:14px;font-weight:bold;font-size:18px;margin-top:12px;cursor:pointer}
    .primary{background:#d4af37;color:#111}
    .blue{background:#1d8cff;color:#fff}
    .danger{background:#d83131;color:#fff}
    .muted{color:#aaa;font-size:13px;line-height:1.5}
    .reward{border:1px solid #444;background:#151515;border-radius:14px;padding:14px;margin-top:12px}
    .reward-title{font-size:20px;font-weight:bold}
    .ok{color:#36d06f}
    .err{color:#ff6969}
    .pill{display:inline-block;background:#333;border-radius:99px;padding:4px 10px;font-size:13px;margin-top:6px}
    #video{display:none;width:100%;border-radius:14px;margin-top:12px;background:#000}
    #scanBox{display:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>🏆 G2 Snooker<br>สแกนใช้สิทธิ์รางวัล</h1>

    <label>รหัสพนักงาน</label>
    <input id="key" type="password" placeholder="กรอกรหัสพนักงาน เช่น g22026">

    <button class="blue" onclick="startScan()">📷 เปิดกล้องสแกน QR Code</button>

    <div id="scanBox">
      <video id="video" playsinline></video>
      <button class="danger" onclick="stopScan()">หยุดสแกน</button>
      <p class="muted">ให้กล้องเห็น QR Code ชัดๆ ระบบจะอ่านให้อัตโนมัติ</p>
    </div>

    <label>หรือกรอก/วางรหัสลูกค้าเอง</label>
    <input id="code" placeholder="qrToken / memberId / userId">

    <button class="primary" onclick="lookup()">ค้นหาสิทธิ์</button>

    <p class="muted">
      ใช้สำหรับ Top 3 รับเสื้อ Ranking และลูกค้าที่มี 15 แต้มขึ้นไป รับส่วนลด 10%
    </p>

    <div id="result"></div>
  </div>

<script>
const $ = (id) => document.getElementById(id);
let stream = null;
let scanning = false;
let detector = null;
let canvas = document.createElement("canvas");
let ctx = canvas.getContext("2d");

$("key").value = localStorage.getItem("g2RewardStaffKey") || "";

function basePath() {
  return window.location.pathname.replace(/\\/$/, "");
}

function saveKey() {
  localStorage.setItem("g2RewardStaffKey", $("key").value.trim());
}

function normalizeQrText(text) {
  const raw = String(text || "").trim();
  try {
    const u = new URL(raw);
    const keys = ["qrToken", "token", "code", "memberId", "uid", "userId", "id"];
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v) return v.trim();
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length) return decodeURIComponent(parts[parts.length - 1]).trim();
  } catch (e) {}
  return raw;
}

async function startScan() {
  saveKey();

  if (!$("key").value.trim()) {
    alert("กรุณากรอกรหัสพนักงานก่อน");
    return;
  }

  try {
    $("scanBox").style.display = "block";
    $("video").style.display = "block";

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    $("video").srcObject = stream;
    await $("video").play();

    scanning = true;

    if ("BarcodeDetector" in window) {
      try {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
      } catch(e) {
        detector = null;
      }
    }

    requestAnimationFrame(scanLoop);
  } catch (e) {
    $("result").innerHTML = '<p class="err">เปิดกล้องไม่ได้: ' + escapeHtml(e.message) + '</p><p class="muted">ถ้าเปิดใน LINE แล้วไม่ได้ ให้ลองเปิดลิงก์นี้ใน Chrome/Safari และกดอนุญาตกล้อง</p>';
  }
}

function stopScan() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  $("video").style.display = "none";
  $("scanBox").style.display = "none";
}

async function scanLoop() {
  if (!scanning) return;

  const video = $("video");

  try {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes && codes.length) {
          onQrFound(codes[0].rawValue);
          return;
        }
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(img.data, img.width, img.height);
        if (qr && qr.data) {
          onQrFound(qr.data);
          return;
        }
      }
    }
  } catch (e) {}

  requestAnimationFrame(scanLoop);
}

function onQrFound(text) {
  const code = normalizeQrText(text);
  $("code").value = code;
  stopScan();
  lookup();
}

async function lookup() {
  saveKey();

  const key = $("key").value.trim();
  const code = $("code").value.trim();
  const result = $("result");

  result.innerHTML = "";

  if (!key || !code) {
    result.innerHTML = '<p class="err">กรุณากรอกรหัสพนักงานและรหัสลูกค้า</p>';
    return;
  }

  result.innerHTML = '<p class="muted">กำลังค้นหา...</p>';

  try {
    const r = await fetch(basePath() + "/lookup?key=" + encodeURIComponent(key) + "&code=" + encodeURIComponent(code));
    const d = await r.json();

    if (!r.ok || !d.ok) {
      result.innerHTML = '<p class="err">' + escapeHtml(d.message || "ค้นหาไม่สำเร็จ") + '</p>';
      return;
    }

    if (!d.rewards.length) {
      result.innerHTML =
        '<p class="ok">พบลูกค้า: ' + escapeHtml(d.member.displayName || d.member.id) + '</p>' +
        '<p class="muted">ยังไม่มีสิทธิ์ที่ใช้งานได้ หรือสิทธิ์ถูกใช้ไปแล้ว</p>';
      return;
    }

    result.innerHTML =
      '<p class="ok">พบลูกค้า: ' + escapeHtml(d.member.displayName || d.member.id) + '</p>' +
      d.rewards.map(renderReward).join("");

  } catch (e) {
    result.innerHTML = '<p class="err">เกิดข้อผิดพลาด: ' + escapeHtml(e.message) + '</p>';
  }
}

function renderReward(r) {
  const typeText = r.rewardType === "ranking_shirt" ? "เสื้อ Ranking" : "ส่วนลด 10%";
  const rankText = r.rank ? "Top " + r.rank : "";
  return [
    '<div class="reward">',
    '<div class="reward-title">' + escapeHtml(r.title || typeText) + '</div>',
    '<div class="pill">' + escapeHtml(typeText + " " + rankText) + '</div>',
    '<p>เดือน: ' + escapeHtml(r.monthKey || "-") + '</p>',
    '<p>คะแนน: ' + Number(r.points || 0) + ' แต้ม</p>',
    '<p class="muted">' + escapeHtml(r.description || "") + '</p>',
    '<button class="danger" onclick="redeem(\\'' + escapeAttr(r.rewardId) + '\\')">ยืนยันใช้สิทธิ์นี้</button>',
    '</div>'
  ].join("");
}

async function redeem(rewardId) {
  saveKey();

  if (!confirm("ยืนยันใช้สิทธิ์นี้? หลังใช้แล้วจะใช้ซ้ำไม่ได้")) return;

  const key = $("key").value.trim();

  try {
    const r = await fetch(basePath() + "/redeem", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ key, rewardId })
    });

    const d = await r.json();

    if (!r.ok || !d.ok) {
      alert(d.message || "ใช้สิทธิ์ไม่สำเร็จ");
      return;
    }

    alert("ใช้สิทธิ์สำเร็จ");
    lookup();

  } catch (e) {
    alert("เกิดข้อผิดพลาด: " + e.message);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function escapeAttr(s) {
  return String(s || "").replace(/'/g, "\\\\'");
}
</script>
</body>
</html>`);
  }
);



function getPreviousMonthKeyBangkok(now = new Date()) {
  const bangkokNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const year = bangkokNow.getFullYear();
  const month = bangkokNow.getMonth();
  const prev = new Date(year, month - 1, 1, 0, 0, 0);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

async function archiveAndResetMonthlyPoints(monthKey, force = false) {
  const finalMonthKey = monthKey || getPreviousMonthKeyBangkok();

  const archiveRef = db.collection("monthlyLeaderboards").doc(finalMonthKey);
  const archiveDoc = await archiveRef.get();

  if (archiveDoc.exists && !force) {
    return {
      ok: true,
      skipped: true,
      reason: "already archived",
      monthKey: finalMonthKey,
    };
  }

  const usersSnap = await db.collection("users").get();

  const ranking = [];

  usersSnap.forEach((doc) => {
    const u = doc.data() || {};
    const role = u.role || "member";
    const points = Number(u.monthlyPoints || 0);

    if (role === "staff" || role === "admin") return;
    if (!Number.isFinite(points) || points <= 0) return;

    ranking.push({
      userId: doc.id,
      displayName: u.displayName || u.name || u.fullName || "สมาชิก",
      memberId: u.memberId || "",
      pictureUrl: u.pictureUrl || u.photoURL || "",
      monthlyPoints: points,
      role,
    });
  });

  ranking.sort((a, b) => {
    if (b.monthlyPoints !== a.monthlyPoints) return b.monthlyPoints - a.monthlyPoints;
    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "th");
  });

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  batch.set(archiveRef, {
    monthKey: finalMonthKey,
    count: ranking.length,
    archivedAt: now,
    resetAt: now,
    force: Boolean(force),
  }, { merge: true });

  ranking.forEach((u, index) => {
    const itemRef = archiveRef.collection("items").doc(u.userId);
    batch.set(itemRef, {
      ...u,
      rank: index + 1,
      monthKey: finalMonthKey,
      archivedAt: now,
    });
  });

  usersSnap.forEach((doc) => {
    const u = doc.data() || {};
    const role = u.role || "member";
    if (role === "staff" || role === "admin") return;

    batch.update(doc.ref, {
      monthlyPoints: 0,
      updatedAt: now,
      lastMonthlyResetMonthKey: finalMonthKey,
    });
  });

  await batch.commit();

  return {
    ok: true,
    skipped: false,
    monthKey: finalMonthKey,
    count: ranking.length,
  };
}

exports.archiveAndResetMonthlyPoints = onSchedule(
  {
    schedule: "30 9 1 * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
    memory: "256MiB",
  },
  async () => {
    return archiveAndResetMonthlyPoints(null, false);
  }
);

exports.archiveAndResetMonthlyPointsHttp = require("firebase-functions/v2/https").onRequest(
  {
    region: "asia-southeast1",
    memory: "256MiB",
    secrets: [REWARD_STAFF_KEY],
  },
  async (req, res) => {
    try {
      const key = req.query.key || (req.body && req.body.key);
      const realKey = process.env.REWARD_STAFF_KEY;

      if (!realKey || String(key) !== String(realKey)) {
        res.status(403).json({ ok: false, message: "รหัสไม่ถูกต้อง" });
        return;
      }

      const monthKey = req.query.monthKey || (req.body && req.body.monthKey) || null;
      const forceRaw = req.query.force || (req.body && req.body.force) || false;
      const force = forceRaw === true || forceRaw === "true" || forceRaw === "1";

      const result = await archiveAndResetMonthlyPoints(monthKey, force);
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({ ok: false, message: e.message || "archive/reset error" });
    }
  }
);

const { createTestRewardFlexToAdmin } = require("./reward-flex-test");

exports.testRewardFlexToAdmin = createTestRewardFlexToAdmin({
  db,
  getLineUserId,
  pushLineMessage,
  LINE_CHANNEL_ACCESS_TOKEN,
  REWARD_STAFF_KEY,
});

const { createBroadcastRewardFlexHttp } = require("./reward-flex-broadcast");

exports.broadcastRewardFlexHttp = createBroadcastRewardFlexHttp({
  db,
  getLineUserId,
  pushLineMessage,
  LINE_CHANNEL_ACCESS_TOKEN,
  REWARD_STAFF_KEY,
});

const { createScheduledBroadcastRewardFlex } = require("./reward-flex-broadcast");

exports.scheduledBroadcastRewardFlex = createScheduledBroadcastRewardFlex({
  db,
  getLineUserId,
  pushLineMessage,
  LINE_CHANNEL_ACCESS_TOKEN,
});

