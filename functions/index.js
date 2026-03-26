const functions = require("firebase-functions");
const admin = require("firebase-admin");

// 初始化管理员权限，让这段代码可以无视任何 Firestore Rules，直接修改数据库
admin.initializeApp();

exports.redeemPromoCode = functions.https.onCall(async (data, context) => {
  // 1. 鉴权：确保调用这个函数的不是黑客脚本，而是你网站上真正登录的用户
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated", 
      "You must be logged in to redeem a code."
    );
  }

  // 2. 拿到前端传过来的激活码
  const { code } = data;

  // 3. 核心密码验证：这段代码永远只存在于服务器，前端看不见！
  if (code !== "RELOMVP2026") {
    // 故意抛出错误，前端的 catch 会捕获到它并显示为红色警告
    throw new functions.https.HttpsError(
      "invalid-argument", 
      "Invalid or expired promo code."
    );
  }

  const uid = context.auth.uid;

  try {
    // 4. 越权提权：由后端强行以管理员身份修改 users 表，无视前端安全规则
    await admin.firestore().collection("users").doc(uid).update({
      isAdmin: true
    });

    return { success: true, message: "Admin rights granted." };
  } catch (error) {
    console.error("Error updating user:", error);
    throw new functions.https.HttpsError(
      "internal", 
      "Server error occurred while redeeming code."
    );
  }
});