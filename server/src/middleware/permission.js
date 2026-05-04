const { getEffectivePermissions } = require("../constants/permissions");

function requirePermission(flag) {
  return (req, _res, next) => {
    const permissions = getEffectivePermissions(req.user || {});
    const moduleWildcard = `${String(flag).split(":")[0]}:*`;
    if (permissions.includes("*") || permissions.includes(flag) || permissions.includes(moduleWildcard)) {
      return next();
    }
    const err = new Error("ليس لديك صلاحية للوصول إلى هذا المورد");
    err.status = 403;
    return next(err);
  };
}

module.exports = { requirePermission };
