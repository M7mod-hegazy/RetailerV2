const express = require("express");
const { UserModel } = require("../models/user.model");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { SYSTEM_OWNER_USERNAME } = require("../services/systemOwner.service");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.get("/", requirePagePermission("users", "view"), (_req, res) => {
  const rows = getDb()
    .prepare(
      "SELECT id, full_name, username, role, is_active, last_login_at, created_at FROM users WHERE COALESCE(is_system_account, 0) = 0 ORDER BY id DESC",
    )
    .all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("users", "add"), requireRole("admin"), (req, res, next) => {
  try {
    const payload = req.body || {};
    if (String(payload.username || "").trim().toLowerCase() === String(SYSTEM_OWNER_USERNAME).toLowerCase()) {
      const err = new Error("System owner username is reserved");
      err.status = 400;
      throw err;
    }

    const user = UserModel.create({
      username: payload.username,
      password: payload.password,
      role: payload.role || "viewer",
      full_name: payload.full_name || payload.username,
    });
    if (payload.full_name) {
      getDb().prepare("UPDATE users SET full_name = ? WHERE id = ?").run(payload.full_name, user.id);
    }
    res.status(201).json({
      success: true,
      data: getDb().prepare("SELECT id, full_name, username, role, is_active, last_login_at FROM users WHERE id = ?").get(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requirePagePermission("users", "edit"), requireRole("admin"), (req, res, next) => {
  try {
    const payload = req.body || {};
    const target = getDb()
      .prepare("SELECT id, is_system_account FROM users WHERE id = ?")
      .get(req.params.id);

    if (!target) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (target.is_system_account) {
      const err = new Error("System owner account cannot be edited");
      err.status = 403;
      throw err;
    }

    getDb()
      .prepare("UPDATE users SET role = ?, is_active = ? WHERE id = ?")
      .run(payload.role || "cashier", payload.is_active === false ? 0 : 1, req.params.id);

    res.json({
      success: true,
      data: getDb()
        .prepare("SELECT id, full_name, username, role, is_active, last_login_at FROM users WHERE id = ?")
        .get(req.params.id),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/permissions", (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const user = getDb()
      .prepare("SELECT id, page_permissions FROM users WHERE id = ?")
      .get(req.params.id);

    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    let permissions;
    if (user.page_permissions) {
      permissions = JSON.parse(user.page_permissions);
    } else {
      const settings = getDb()
        .prepare("SELECT default_user_permissions FROM settings WHERE id = 1")
        .get();
      permissions = settings?.default_user_permissions
        ? JSON.parse(settings.default_user_permissions)
        : {};
    }

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/permissions", (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const target = getDb()
      .prepare("SELECT id, role FROM users WHERE id = ?")
      .get(req.params.id);

    if (!target) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (target.role === "admin") {
      return res.status(403).json({ error: "cannot_modify_admin_permissions" });
    }

    const payload = req.body || {};
    const permissions = payload.permissions || {};

    if (typeof permissions !== "object" || Array.isArray(permissions)) {
      const err = new Error("Permissions must be a valid object");
      err.status = 400;
      throw err;
    }

    const permissionsJson = JSON.stringify(permissions);
    getDb()
      .prepare("UPDATE users SET page_permissions = ? WHERE id = ?")
      .run(permissionsJson, req.params.id);

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
