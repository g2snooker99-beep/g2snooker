import shutil, py_compile, sys

# ── 1) Backup ──────────────────────────────────────────────
shutil.copy("app.py", "app.py.bak_stockdetail")
shutil.copy("templates/index.html", "templates/index.html.bak_stockdetail")

# ── 2) Patch app.py: stock_check_detail คืนค่า stock_qty ปัจจุบันมาด้วย ──
with open("app.py", "r", encoding="utf-8") as f:
    app_src = f.read()

old_detail = '''@app.route("/api/stock_check/<int:check_id>")
def stock_check_detail(check_id):
    conn = get_db_connection()
    head = conn.execute("SELECT * FROM stock_checks WHERE id=?", (check_id,)).fetchone()
    if not head:
        conn.close()
        return jsonify({"status":"error","msg":"ไม่พบรอบเช็คสต๊อก"}),404
    items = conn.execute("SELECT * FROM stock_check_items WHERE check_id=? ORDER BY id", (check_id,)).fetchall()
    conn.close()
    return jsonify({"check": dict(head), "items":[dict(i) for i in items]})'''

new_detail = '''@app.route("/api/stock_check/<int:check_id>")
def stock_check_detail(check_id):
    conn = get_db_connection()
    head = conn.execute("SELECT * FROM stock_checks WHERE id=?", (check_id,)).fetchone()
    if not head:
        conn.close()
        return jsonify({"status":"error","msg":"ไม่พบรอบเช็คสต๊อก"}),404
    items = conn.execute("SELECT * FROM stock_check_items WHERE check_id=? ORDER BY id", (check_id,)).fetchall()
    items_out = []
    for i in items:
        di = dict(i)
        cur = None
        if di.get('product_id'):
            inv = conn.execute("SELECT stock_qty FROM inventory WHERE id=?", (di['product_id'],)).fetchone()
            cur = inv['stock_qty'] if inv else None
        di['current_stock_qty'] = cur
        items_out.append(di)
    conn.close()
    return jsonify({"check": dict(head), "items": items_out})'''

if old_detail not in app_src:
    print("❌ ไม่พบโค้ดเดิมของ stock_check_detail ใน app.py (อาจถูกแก้ไปแล้ว หรือไม่ตรงเป๊ะ) - หยุดแก้ app.py")
    sys.exit(1)

app_src = app_src.replace(old_detail, new_detail, 1)
with open("app.py", "w", encoding="utf-8") as f:
    f.write(app_src)

try:
    py_compile.compile("app.py", doraise=True)
    print("✅ app.py แก้ไขสำเร็จ และ syntax ถูกต้อง")
except py_compile.PyCompileError as e:
    print("❌ app.py มี syntax error หลังแก้:", e)
    shutil.copy("app.py.bak_stockdetail", "app.py")
    print("↩️  คืนค่า app.py กลับเป็นเดิมแล้ว")
    sys.exit(1)

# ── 3) Patch templates/index.html: เพิ่มหัวตาราง 2 คอลัมน์ ──
with open("templates/index.html", "r", encoding="utf-8") as f:
    html_src = f.read()

old_thead = '<thead><tr><th>สินค้า</th><th>จำนวนใน POS ตอนนับ</th><th>จำนวนนับจริง</th><th>ผลต่าง</th></tr></thead>'
new_thead = '<thead><tr><th>สินค้า</th><th>จำนวนใน POS ตอนนับ</th><th>จำนวนนับจริง</th><th>ผลต่าง</th><th>สต๊อกปัจจุบัน (สด)</th><th>จะเหลือหลังยืนยัน</th></tr></thead>'

if old_thead not in html_src:
    print("❌ ไม่พบ thead เดิมของ stock detail table - หยุดแก้ index.html")
    sys.exit(1)

html_src = html_src.replace(old_thead, new_thead, 1)

# ── 4) Patch JS: viewStockCheckDetail ให้ render 2 คอลัมน์ใหม่ ──
old_js = '''    document.getElementById('stock-detail-body').innerHTML = rd.items.map(it=>{
      const diffHtml = it.diff===0 ? '<span class="text-success">0</span>'
        : it.diff<0 ? '<span class="text-danger">'+it.diff+'</span>'
        : '<span class="text-info">+'+it.diff+'</span>';
      return '<tr><td class="text-start">'+it.product_name+'</td><td>'+it.pos_qty_at_check+'</td><td>'+it.actual_qty+'</td><td>'+diffHtml+'</td></tr>';
    }).join('');'''

new_js = '''    document.getElementById('stock-detail-body').innerHTML = rd.items.map(it=>{
      const diffHtml = it.diff===0 ? '<span class="text-success">0</span>'
        : it.diff<0 ? '<span class="text-danger">'+it.diff+'</span>'
        : '<span class="text-info">+'+it.diff+'</span>';
      const hasCur = (it.current_stock_qty!==null && it.current_stock_qty!==undefined);
      const curHtml = hasCur ? it.current_stock_qty : '-';
      const projHtml = hasCur ? (it.current_stock_qty + it.diff) : '-';
      return '<tr><td class="text-start">'+it.product_name+'</td><td>'+it.pos_qty_at_check+'</td><td>'+it.actual_qty+'</td><td>'+diffHtml+'</td><td class="text-warning">'+curHtml+'</td><td class="text-info">'+projHtml+'</td></tr>';
    }).join('');'''

if old_js not in html_src:
    print("❌ ไม่พบโค้ด JS เดิมของ viewStockCheckDetail - หยุดแก้ index.html")
    sys.exit(1)

html_src = html_src.replace(old_js, new_js, 1)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(html_src)

print("✅ templates/index.html แก้ไขสำเร็จ (เพิ่มคอลัมน์ 'สต๊อกปัจจุบัน (สด)' และ 'จะเหลือหลังยืนยัน')")
print("")
print("สรุป: diff ที่ใช้ยืนยันปรับสต๊อกจริงยังคำนวณแบบเดิม (ถูกต้องอยู่แล้ว)")
print("ที่เพิ่มมาคือแค่ 2 คอลัมน์โชว์ให้เห็นว่าสต๊อกตอนนี้เท่าไหร่ และยืนยันแล้วจะเหลือเท่าไหร่")
