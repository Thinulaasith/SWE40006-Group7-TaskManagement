export async function audit(db, actor, action, detail, scope = {}, adminOnly = false) {
  await db.query(`INSERT INTO activity (actor_id,action,detail,project_id,owner_id,task_id,admin_only)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [actor,action,detail.slice(0,500),scope.project_id || null,scope.owner_id || null,scope.task_id || scope.id || null,adminOnly]);
}
