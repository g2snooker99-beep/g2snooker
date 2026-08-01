const { onRequest } = require("firebase-functions/v2/https");

function bubble(kind) {
  const d = {
    top3: {
      alt: "G2 Snooker ขอแสดงความยินดี คุณได้รับเสื้อ Ranking",
      icon: "🏆",
      head: "ขอแสดงความยินดี!",
      headSize: "xxl",
      title: "เสื้อ Ranking",
      titleSize: "xxl",
      desc: "คุณคือหนึ่งในลูกค้า Top Ranking ประจำเดือน",
      note: "กรุณาติดต่อรับรางวัลได้ที่ร้าน G2 Snooker เท่านั้น",
      close: "เดือนหน้ามาลุ้นรักษาอันดับกันต่อ 💚\n1 ชั่วโมง = 1 แต้ม",
      color: "#FFD166",
      box: "#2B250A",
      btn: "รับสิทธิ์ที่ร้าน"
    },
    discount: {
      alt: "G2 Snooker คุณได้รับสิทธิ์ส่วนลด 10%",
      icon: "🎟️",
      head: "คุณได้รับสิทธิ์รางวัล",
      headSize: "xxl",
      title: "ส่วนลด 10%",
      titleSize: "xxl",
      desc: "สำหรับลูกค้าที่สะสมแต้มถึงเกณฑ์",
      note: "กรุณาติดต่อใช้สิทธิ์ได้ที่ร้าน G2 Snooker เท่านั้น",
      close: "อีกนิดเดียวก็มีสิทธิ์ลุ้น Top 3 ได้เช่นกัน 🏆",
      color: "#2DE080",
      box: "#092619",
      btn: "ใช้สิทธิ์ที่ร้าน"
    },
    none: {
      alt: "G2 Snooker เดือนนี้ยังไม่ได้รับรางวัล กลับมาสะสมต่อกันนะ",
      icon: "💚",
      head: "เดือนนี้ยังไม่ถึงรางวัล",
      headSize: "xl",
      title: "อีกนิดเดียว",
      titleSize: "xl",
      desc: "แต่ไม่ต้องเสียใจ ทุกการมาใช้บริการคือโอกาสลุ้นรางวัลเดือนถัดไป",
      note: "1 ชั่วโมง = 1 แต้ม\nTop 3 รับเสื้อ Ranking\nแต้มถึงเกณฑ์ มีสิทธิ์รับส่วนลด",
      close: "เดือนหน้าอาจเป็นคิวของคุณก็ได้ 🎯",
      color: "#9AFF5F",
      box: "#102414",
      btn: "กลับมาสะสมกันต่อ"
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
            size: d.headSize || "xxl",
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
                size: d.titleSize || "xxl",
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
              uri: "https://liff.line.me/2010084269-aui1GaWz"
            }
          }
        ]
      }
    }
  };
}

function createTestRewardFlexToAdmin({ db, getLineUserId, pushLineMessage, LINE_CHANNEL_ACCESS_TOKEN, REWARD_STAFF_KEY }) {
  return onRequest(
    {
      region: "asia-southeast1",
      memory: "256MiB",
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

        const adminsSnap = await db.collection("users").where("role", "==", "admin").get();

        let sent = 0;
        const results = [];

        for (const doc of adminsSnap.docs) {
          const user = doc.data() || {};
          const lineUserId = getLineUserId(doc.id, user);

          if (!lineUserId) {
            results.push({ userId: doc.id, ok: false, reason: "missing lineUserId" });
            continue;
          }

          await pushLineMessage(lineUserId, [
            bubble("top3"),
            bubble("discount"),
            bubble("none")
          ]);

          sent++;
          results.push({
            userId: doc.id,
            displayName: user.displayName || user.name || "",
            ok: true
          });
        }

        res.status(200).json({ ok: true, sent, results });
      } catch (e) {
        console.error("testRewardFlexToAdmin failed", e);
        res.status(500).json({
          ok: false,
          message: e.message || "send flex test error"
        });
      }
    }
  );
}

module.exports = {
  createTestRewardFlexToAdmin,
  bubble
};
