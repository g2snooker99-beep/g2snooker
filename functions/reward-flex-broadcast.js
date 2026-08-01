const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

function bubble(kind, extra = {}) {
  const d = {
    top3: {
      alt: "G2 Snooker ขอแสดงความยินดี คุณได้รับเสื้อ Ranking",
      icon: "🏆",
      head: "ขอแสดงความยินดี!",
      title: extra.rank ? `Top ${extra.rank} รับเสื้อ Ranking` : "เสื้อ Ranking",
      desc: "คุณคือหนึ่งในลูกค้า Top Ranking ประจำเดือน",
      note: "กรุณาติดต่อรับรางวัลได้ที่ร้าน G2 Snooker เท่านั้น",
      close: "เดือนหน้ามาลุ้นรักษาอันดับกันต่อ 💚\n1 ชั่วโมง = 1 แต้ม",
      color: "#FFD166",
      box: "#2B250A",
      btn: "ดูสิทธิ์ของฉัน",
      uri: "https://member-3e17e.web.app/reward-history.html"
    },
    discount: {
      alt: "G2 Snooker คุณได้รับสิทธิ์ส่วนลด 10%",
      icon: "🎟️",
      head: "คุณได้รับสิทธิ์รางวัล",
      title: "ส่วนลด 10%",
      desc: "สำหรับลูกค้าที่สะสมแต้มถึงเกณฑ์",
      note: "กรุณาติดต่อใช้สิทธิ์ได้ที่ร้าน G2 Snooker เท่านั้น",
      close: "อีกนิดเดียวก็มีสิทธิ์ลุ้น Top 3 ได้เช่นกัน 🏆",
      color: "#2DE080",
      box: "#092619",
      btn: "ดูสิทธิ์ของฉัน",
      uri: "https://member-3e17e.web.app/reward-history.html"
    },
    none: {
      alt: "G2 Snooker เดือนนี้ยังไม่ได้รับรางวัล กลับมาสะสมต่อกันนะ",
      icon: "💚",
      head: "ยังไม่ถึงรางวัลเดือนนี้",
      title: "อีกนิดเดียว",
      desc: "แต่ไม่ต้องเสียใจ ทุกการมาใช้บริการคือโอกาสลุ้นรางวัลเดือนถัดไป",
      note: "1 ชั่วโมง = 1 แต้ม\nTop 3 รับเสื้อ Ranking\nแต้มถึงเกณฑ์ มีสิทธิ์รับส่วนลด",
      close: "เดือนหน้าอาจเป็นคิวของคุณก็ได้ 🎯",
      color: "#9AFF5F",
      box: "#102414",
      btn: "ดูอันดับเดือนนี้",
      uri: "https://member-3e17e.web.app/leaderboard.html"
    }
  }[kind];

  return {
    type: "flex",
    altText: d.alt,
    contents: {
      type: "bubble",
      size: "mega",
      styles: {
        body: { backgroundColor: "#07110C" },
        footer: { backgroundColor: "#07110C" }
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `${d.icon} G2 SNOOKER`,
            weight: "bold",
            size: "xl",
            align: "center",
            color: "#89FF4D"
          },
          {
            type: "text",
            text: d.head,
            weight: "bold",
            size: "xl",
            align: "center",
            color: "#FFFFFF",
            margin: "md",
            wrap: true
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: d.box,
            cornerRadius: "18px",
            paddingAll: "16px",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: d.title,
                weight: "bold",
                size: "xl",
                align: "center",
                color: d.color,
                wrap: true
              },
              {
                type: "text",
                text: d.desc,
                size: "sm",
                align: "center",
                wrap: true,
                color: "#FFFFFF",
                margin: "sm"
              }
            ]
          },
          {
            type: "text",
            text: d.note,
            size: "md",
            align: "center",
            wrap: true,
            color: "#D9FBE4",
            margin: "lg"
          },
          {
            type: "separator",
            margin: "lg",
            color: "#2DE080"
          },
          {
            type: "text",
            text: d.close,
            size: "sm",
            align: "center",
            wrap: true,
            color: "#9FE8C0",
            margin: "lg"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: d.color,
            action: {
              type: "uri",
              label: d.btn,
              uri: d.uri
            }
          }
        ]
      }
    }
  };
}

function createBroadcastRewardFlexHttp({ db, getLineUserId, pushLineMessage, LINE_CHANNEL_ACCESS_TOKEN, REWARD_STAFF_KEY }) {
  return onRequest(
    {
      region: "asia-southeast1",
      memory: "512MiB",
      timeoutSeconds: 540,
      secrets: [LINE_CHANNEL_ACCESS_TOKEN, REWARD_STAFF_KEY],
    },
    async (req, res) => {
      try {
        const key = req.query.key || (req.body && req.body.key);
        const realKey = process.env.REWARD_STAFF_KEY;

        if (!realKey || String(key) !== String(realKey)) {
          res.status(403).json({ ok: false, message: "รหัสไม่ถูกต้อง" });
          return;
        }

        const monthKey = String(req.query.monthKey || (req.body && req.body.monthKey) || "").trim();
        if (!monthKey) {
          res.status(400).json({ ok: false, message: "missing monthKey เช่น 2026-06" });
          return;
        }

        const usersSnap = await db.collection("users").get();
        const rewardsSnap = await db.collection("monthlyRewards")
          .where("monthKey", "==", monthKey)
          .where("status", "==", "active")
          .get();

        const rewardByUser = new Map();

        rewardsSnap.forEach((doc) => {
          const r = { id: doc.id, ...(doc.data() || {}) };
          if (!r.userId) return;
          if (!rewardByUser.has(r.userId)) rewardByUser.set(r.userId, []);
          rewardByUser.get(r.userId).push(r);
        });

        let sentTop3 = 0;
        let sentDiscount = 0;
        let sentNone = 0;
        let skipped = 0;
        const results = [];

        for (const doc of usersSnap.docs) {
          const user = doc.data() || {};
          const role = user.role || "member";

          if (role === "admin" || role === "staff") continue;

          const lineUserId = getLineUserId(doc.id, user);
          if (!lineUserId) {
            skipped++;
            results.push({ userId: doc.id, ok: false, reason: "missing lineUserId" });
            continue;
          }

          const rewards = rewardByUser.get(doc.id) || [];

          let msg;
          const shirt = rewards.find(r => r.rewardType === "ranking_shirt");
          const discount = rewards.find(r => r.rewardType === "discount_10");

          if (shirt) {
            msg = bubble("top3", { rank: shirt.rank });
            sentTop3++;
          } else if (discount) {
            msg = bubble("discount");
            sentDiscount++;
          } else {
            msg = bubble("none");
            sentNone++;
          }

          await pushLineMessage(lineUserId, [msg]);

          results.push({
            userId: doc.id,
            displayName: user.displayName || user.name || "",
            ok: true,
            type: shirt ? "top3" : discount ? "discount" : "none"
          });

          await new Promise(resolve => setTimeout(resolve, 250));
        }

        await db.collection("rewardFlexBroadcastRuns").add({
          monthKey,
          sentTop3,
          sentDiscount,
          sentNone,
          skipped,
          totalSent: sentTop3 + sentDiscount + sentNone,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).json({
          ok: true,
          monthKey,
          sentTop3,
          sentDiscount,
          sentNone,
          skipped,
          totalSent: sentTop3 + sentDiscount + sentNone,
          results
        });
      } catch (e) {
        console.error("broadcastRewardFlexHttp failed", e);
        res.status(500).json({
          ok: false,
          message: e.message || "broadcast reward flex error"
        });
      }
    }
  );
}

module.exports = {
  createBroadcastRewardFlexHttp,
  bubble
};


const { onSchedule } = require("firebase-functions/v2/scheduler");

function previousMonthKeyBangkok() {
  const now = new Date();
  const bangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const y = bangkok.getFullYear();
  const m = bangkok.getMonth(); // เดือนปัจจุบันแบบ 0-11

  const prev = new Date(y, m - 1, 1);
  return prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
}

async function runRewardFlexBroadcast({ db, getLineUserId, pushLineMessage, monthKey, force = false }) {
  const runRef = db.collection("rewardFlexBroadcastRuns").doc(monthKey);
  const runDoc = await runRef.get();

  if (runDoc.exists && !force) {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent",
      monthKey,
      message: "เดือนนี้เคยส่ง Flex แจ้งรางวัลแล้ว"
    };
  }

  const usersSnap = await db.collection("users").get();

  const rewardsSnap = await db.collection("monthlyRewards")
    .where("monthKey", "==", monthKey)
    .where("status", "==", "active")
    .get();

  const rewardByUser = new Map();

  rewardsSnap.forEach((doc) => {
    const r = { id: doc.id, ...(doc.data() || {}) };
    if (!r.userId) return;

    if (!rewardByUser.has(r.userId)) {
      rewardByUser.set(r.userId, []);
    }

    rewardByUser.get(r.userId).push(r);
  });

  let sentTop3 = 0;
  let sentDiscount = 0;
  let sentNone = 0;
  let skipped = 0;
  const results = [];

  for (const doc of usersSnap.docs) {
    const user = doc.data() || {};
    const role = user.role || "member";

    if (role === "admin" || role === "staff") continue;

    const lineUserId = getLineUserId(doc.id, user);

    if (!lineUserId) {
      skipped++;
      results.push({
        userId: doc.id,
        ok: false,
        reason: "missing_line_user_id"
      });
      continue;
    }

    const rewards = rewardByUser.get(doc.id) || [];
    const shirt = rewards.find(r => r.rewardType === "ranking_shirt");
    const discount = rewards.find(r => r.rewardType === "discount_10");

    let msg;

    if (shirt) {
      msg = bubble("top3", { rank: shirt.rank });
      sentTop3++;
    } else if (discount) {
      msg = bubble("discount");
      sentDiscount++;
    } else {
      msg = bubble("none");
      sentNone++;
    }

    await pushLineMessage(lineUserId, [msg]);

    results.push({
      userId: doc.id,
      displayName: user.displayName || user.name || "",
      ok: true,
      type: shirt ? "top3" : discount ? "discount" : "none"
    });

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  const summary = {
    ok: true,
    skipped: false,
    monthKey,
    sentTop3,
    sentDiscount,
    sentNone,
    skippedUsers: skipped,
    totalSent: sentTop3 + sentDiscount + sentNone,
    totalUsers: usersSnap.size,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await runRef.set(summary, { merge: true });

  return {
    ...summary,
    createdAt: undefined,
    results
  };
}

function createScheduledBroadcastRewardFlex({ db, getLineUserId, pushLineMessage, LINE_CHANNEL_ACCESS_TOKEN }) {
  return onSchedule(
    {
      schedule: "0 10 1 * *",
      timeZone: "Asia/Bangkok",
      region: "asia-southeast1",
      memory: "512MiB",
      timeoutSeconds: 540,
      secrets: [LINE_CHANNEL_ACCESS_TOKEN],
    },
    async () => {
      const monthKey = previousMonthKeyBangkok();

      const result = await runRewardFlexBroadcast({
        db,
        getLineUserId,
        pushLineMessage,
        monthKey,
        force: false
      });

      console.log("scheduledBroadcastRewardFlex result", result);
      return result;
    }
  );
}

module.exports.createScheduledBroadcastRewardFlex = createScheduledBroadcastRewardFlex;
module.exports.runRewardFlexBroadcast = runRewardFlexBroadcast;
