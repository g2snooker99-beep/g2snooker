with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

marker = '# ── STOCK CHECK'
code = '''# ── TEMP: FIX SORT ORDER (ลบทิ้งหลังใช้เสร็จ) ─────────────────
@app.route("/api/debug/fix_sort_order")
def debug_fix_sort_order():
    secret = request.args.get("key", "")
    if secret != "g2_cron_2026":
        return jsonify({"error": "unauthorized"}), 403
    conn = get_db_connection()
    mapping = {3:1, 5:2, 1:3, 2:4, 4:5}
    for table_id, order in mapping.items():
        conn.execute("UPDATE tables_config SET sort_order=? WHERE id=?", (order, table_id))
    conn.commit()
    rows = conn.execute("SELECT id, name, sort_order FROM tables_config ORDER BY sort_order").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

'''
idx = content.find(marker)
if idx == -1:
    print("ไม่เจอ marker!")
else:
    content = content[:idx] + code + content[idx:]
    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("แทรก endpoint สำเร็จ")
