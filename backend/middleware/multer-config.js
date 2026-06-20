const multer = require("multer");
const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");

// 1. 初始化 AWS S3 客户端（部署在 Lambda 时，AWS 会自动读取 IAM 角色权限，通常无需硬编码 keys）
const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-3", // 替换为你的 S3 桶所在区域
});

// 2. 保留你原有的文件后缀映射
const MIME_TYPES = {
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// 3. 配置配置 Multer-S3 存储引擎
const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME, // 建议通过环境变量管理你的新存储桶名称
  metadata: (req, file, callback) => {
    callback(null, { fieldName: file.fieldname });
  },
  key: (req, file, callback) => {
    console.log("正在上传文件:", file.originalname); // 调试日志，查看上传的文件名和类型
    // 完美继承你原有的文件名标准化逻辑：
    // 1. 去除原文件名中的后缀（避免出现 .jpg.jpg 的情况）
    const originalNameWithoutExt =
      file.originalname.substring(0, file.originalname.lastIndexOf(".")) ||
      file.originalname;
    // 2. 将空格替换为下划线
    const name = originalNameWithoutExt.split(" ").join("_");
    // 3. 获取对应的标准后缀
    const extension = MIME_TYPES[file.mimetype];

    // 4. 生成最终在 S3 上的路径和文件名（例如存放在 images/ 文件夹下）
    callback(null, "images/" + name + "_" + Date.now() + "." + extension);
  },
});

// 4. 导出中间件（保留了你原有的 1MB 大小限制和 .single("image")）
module.exports = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 限制 1MB
}).single("image");
