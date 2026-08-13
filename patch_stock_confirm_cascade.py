import shutil, py_compile, sys

shutil.copy("app.py", "app.py.bak_cascadeconfirm")

with open("app.py", "r", encoding="utf-8") as f:
    src = f.read()

old_func = '''@app.route("/api/stock_check/<int:check_id>/confirm", methods=["POST"])
def stock_check_confirm(check_id):
    d = request.json or {}
    confirmed_by = d.get('confirmed_by','ไม่ระบุ')
    conn = get_db_connection()
    head = conn.execute("SELECT * FROM stock_checks WHERE id=?", (check_id,)).fetchone()
    if not head:
        conn.close()
        return jsonify({"status":"error","msg":"ไม่พบรอบเช็คสต๊อก"}),404
    if head['status'] == 'confirmed':
        conn.close()
        return jsonify({"status":"error","msg":"รอบนี้ถูกยืนยันปรับสต๊อกไปแล้ว"}),400
    items = conn.execute("SELECT * FROM stock_check_items WHERE check_id=?", (check_id,)).fetchall()
    for it in items:
        if it['product_id']:
            # แก้บัค: เดิมใช้ SET stock_qty = actual_qty (เขียนทับตรงๆ)
            # ทำให้ยอดขายที่เกิดขึ้นระหว่างช่วงนับสต๊อก -> ยืนยัน หายไปจากสต๊อก
            # เปลี่ยนเป็นคำนวณส่วนต่างแล้วบวก/ลบแทน ปลอดภัยกว่า ไม่ทับยอดขายที่เกิดขึ้นระหว่างรอยืนยัน
            diff = it['actual_qty'] - it['pos_qty_at_check']
            conn.execute("UPDATE inventory SET stock_qty = stock_qty + ? WHERE id=?", (diff, it['product_id']))
    now_iso = datetime.now().isoformat()
    conn.execute("UPDATE stock_checks SET status='confirmed', confirmed_by=?, confirmed_at=? WHERE id=?",
                 (confirmed_by, now_iso, check_id))
    conn.commit(); conn.close()
    try:
        log_activity('ยืนยันปรับสต๊อก', '', f"ปรับสต๊อกตามรอบเช็ค #{check_id} ({len(items)} รายการ)", confirmed_by)
    except Exception as le:
        print(f"[WARN] log_activity confirm stock: {le}")
    return jsonify({"status":"success","adjusted_items":len(items)})'''

new_func = '''@app.route("/api/stock_check/<int:check_id>/confirm", methods=["POST"])
def stock_check_confirm(check_id):
    d = request.json or {}
    confirmed_by = d.get('confirmed_by','ไม่ระบุ')
    conn = get_db_connection()
    head = conn.execute("SELECT * FROM stock_checks WHERE id=?", (check_id,)).fetchone()
    if not head:
        conn.close()
        return jsonify({"status":"error","msg":"ไม่พบรอบเช็คสต๊อก"}),404
    if head['status'] == 'confirmed':
        conn.close()
        return jsonify({"status":"error","msg":"รอบนี้ถูกยืนยันปรับสต๊อกไปแล้ว"}),400
    items = conn.execute("SELECT * FROM stock_check_items WHERE check_id=?", (check_id,)).fetchall()
    for it in items:
        if it['product_id']:
            # แก้บัค: เดิมใช้ SET stock_qty = actual_qty (เขียนทับตรงๆ)
            # ทำให้ยอดขายที่เกิดขึ้นระหว่างช่วงนับสต๊อก -> ยืนยัน หายไปจากสต๊อก
            # เปลี่ยนเป็นคำนวณส่วนต่างแล้วบวก/ลบแทน ปลอดภัยกว่า ไม่ทับยอดขายที่เกิดขึ้นระหว่างรอยืนยัน
            diff = it['actual_qty'] - it['pos_qty_at_check']
            conn.execute("UPDATE inventory SET stock_qty = stock_qty + ? WHERE id=?", (diff, it['product_id']))
    now_iso = datetime.now().isoformat()
    conn.execute("UPDATE stock_checks SET status='confirmed', confirmed_by=?, confirmed_at=? WHERE id=?",
                 (confirmed_by, now_iso, check_id))

    # ── ปิดรอบเก่าที่ยัง "รอยืนยัน" ค้างอยู่ก่อนหน้ารอบนี้ ──
    # ยึดผลตามรอบล่าสุด (check_id) เท่านั้น รอบเก่าแค่เปลี่ยนสถานะเป็นยืนยันแล้ว
    # แต่ "ไม่" เอา diff ของรอบเก่ามาปรับสต๊อกซ้ำ (ถูกรอบล่าสุดแทนที่ไปแล้ว)
    stale = conn.execute(
        "SELECT id FROM stock_checks WHERE status='pending' AND id<>? AND created_at<=?",
        (check_id, head['created_at'])
    ).fetchall()
    stale_ids = [s['id'] for s in stale]
    for sid in stale_ids:
        conn.execute(
            "UPDATE stock_checks SET status='confirmed', confirmed_by=?, confirmed_at=? WHERE id=?",
            (confirmed_by + f' (ปิดอัตโนมัติ ถูกแทนที่โดยรอบ #{check_id})', now_iso, sid)
        )

    conn.commit(); conn.close()
    try:
        log_activity('ยืนยันปรับสต๊อก', '', f"ปรับสต๊อกตามรอบเช็ค #{check_id} ({len(items)} รายการ)", confirmed_by)
        if stale_ids:
            log_activity('ปิดรอบเช็คสต๊อกค้าง', '', f"ปิดอัตโนมัติ {len(stale_ids)} รอบเก่า (#{', #'.join(map(str,stale_ids))}) ถูกแทนที่โดยรอบ #{check_id}", confirmed_by)
    except Exception as le:
        print(f"[WARN] log_activity confirm stock: {le}")
    return jsonify({"status":"success","adjusted_items":len(items),"auto_closed":stale_ids})'''

if old_func not in src:
    print("❌ ไม่พบฟังก์ชันเดิมของ stock_check_confirm ใน app.py (โค้ดอาจถูกแก้ไปแล้ว) - หยุดแก้")
    sys.exit(1)

src = src.replace(old_func, new_func, 1)
with open("app.py", "w", encoding="utf-8") as f:
    f.write(src)

try:
    py_compile.compile("app.py", doraise=True)
    print("✅ app.py แก้ไขสำเร็จ และ syntax ถูกต้อง")
except py_compile.PyCompileError as e:
    print("❌ syntax error หลังแก้:", e)
    shutil.copy("app.py.bak_cascadeconfirm", "app.py")
    print("↩️  คืนค่า app.py กลับเป็นเดิมแล้ว")
    sys.exit(1)

print("")
print("สรุปพฤติกรรมใหม่:")
print("- กดยืนยันรอบไหน รอบนั้นปรับสต๊อกจริงตาม diff ตามปกติ")
print("- รอบ 'รอยืนยัน' อื่นๆ ที่เก่ากว่ารอบที่กดยืนยัน (created_at เก่ากว่า) จะถูกเปลี่ยนเป็น 'ยืนยันแล้ว' อัตโนมัติ")
print("- รอบเก่าที่ถูกปิดอัตโนมัติ จะไม่เอา diff ไปปรับสต๊อกซ้ำ (กัน double-adjust)")
print("- รอบ 'รอยืนยัน' ที่ใหม่กว่ารอบที่กด (ถ้ามี) จะยังคงค้างเหมือนเดิม ไม่ถูกแตะ")
