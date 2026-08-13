import shutil, py_compile, sys

shutil.copy("database.py", "database.py.bak_shiftview")
shutil.copy("templates/index.html", "templates/index.html.bak_shiftview")

# ── 1) เพิ่ม permission key 'shift_view' ใน database.py ──
with open("database.py", "r", encoding="utf-8") as f:
    db_src = f.read()

old_perm_line = "    ('shift_close','ส่งกะ / ปิดจอ','ระบบ'),"
new_perm_block = "    ('shift_close','ส่งกะ / ปิดจอ','ระบบ'),\n    ('shift_view','ดูตารางงาน / ตารางกะ','พนักงาน'),"

if old_perm_line not in db_src:
    print("❌ ไม่พบบรรทัด shift_close เดิมใน database.py - หยุดแก้")
    sys.exit(1)

db_src = db_src.replace(old_perm_line, new_perm_block, 1)

old_default = "DEFAULT_STAFF_PERMISSIONS = [\n    'table_open','order_remove','bill_history','bill_print',\n    'expense_add','expense_view','exchange','shift_close',\n]"
new_default = "DEFAULT_STAFF_PERMISSIONS = [\n    'table_open','order_remove','bill_history','bill_print',\n    'expense_add','expense_view','exchange','shift_close','shift_view',\n]"

if old_default not in db_src:
    print("⚠️  ไม่พบ DEFAULT_STAFF_PERMISSIONS แบบเป๊ะ - จะข้ามส่วนนี้ (permission ใหม่จะยังใช้ได้ แต่พนักงานเก่าต้องไปติ๊กสิทธิ์เองในหน้าจัดการสิทธิ์)")
else:
    db_src = db_src.replace(old_default, new_default, 1)
    print("✅ เพิ่ม 'shift_view' เข้า DEFAULT_STAFF_PERMISSIONS แล้ว (พนักงานใหม่ที่สร้างต่อจากนี้จะได้สิทธิ์นี้อัตโนมัติ)")

with open("database.py", "w", encoding="utf-8") as f:
    f.write(db_src)

try:
    py_compile.compile("database.py", doraise=True)
    print("✅ database.py แก้ไขสำเร็จ และ syntax ถูกต้อง")
except py_compile.PyCompileError as e:
    print("❌ database.py syntax error:", e)
    shutil.copy("database.py.bak_shiftview", "database.py")
    sys.exit(1)

# ── 2) แก้ templates/index.html: แยก schedule-view ออกจาก payroll_manage ──
with open("templates/index.html", "r", encoding="utf-8") as f:
    html_src = f.read()

old_map = """  const map={
    'btn-pos':'table_open','btn-history':'bill_history','btn-inventory':'inventory_view',
    'btn-expense':'expense_add','btn-report':'report_view','btn-payroll':'payroll_manage',
    'btn-settings':'settings_manage','btn-shift':'shift_close','btn-exchange':'exchange'
  };"""
new_map = """  const map={
    'btn-pos':'table_open','btn-history':'bill_history','btn-inventory':'inventory_view',
    'btn-expense':'expense_add','btn-report':'report_view','btn-payroll':'payroll_manage',
    'btn-schedule':'shift_view',
    'btn-settings':'settings_manage','btn-shift':'shift_close','btn-exchange':'exchange'
  };"""

if old_map not in html_src:
    print("❌ ไม่พบ sidebar map เดิม - หยุดแก้ templates/index.html")
    sys.exit(1)
html_src = html_src.replace(old_map, new_map, 1)

old_view_map = "  'pos-view':'table_open','schedule-view':'payroll_manage','cancel-log-view':'table_cancel','history-view':'bill_history','inventory-view':'inventory_view',"
new_view_map = "  'pos-view':'table_open','schedule-view':'shift_view','cancel-log-view':'table_cancel','history-view':'bill_history','inventory-view':'inventory_view',"

if old_view_map not in html_src:
    print("❌ ไม่พบ PERM_MAP_VIEW เดิม - หยุดแก้ templates/index.html")
    sys.exit(1)
html_src = html_src.replace(old_view_map, new_view_map, 1)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(html_src)

print("✅ templates/index.html แก้ไขสำเร็จ")
print("")
print("สรุป:")
print("- เพิ่มสิทธิ์ใหม่ 'shift_view' (ดูตารางงาน/ตารางกะ) แยกจาก 'payroll_manage' (เงินเดือน) เด็ดขาด")
print("- ปุ่ม sidebar 'ตารางงานพนักงาน' และหน้า schedule-view ตอนนี้เช็คสิทธิ์ 'shift_view'")
print("- ปุ่ม 'พนักงาน & เงินเดือน' (payroll-view) ยังคงเช็ค 'payroll_manage' เหมือนเดิม ไม่กระทบ")
print("- ต้องไปที่หน้า 'จัดการสิทธิ์พนักงาน' แล้วติ๊กเปิด 'ดูตารางงาน / ตารางกะ' ให้พนักงานที่ต้องการรายบุคคล")
print("  (พนักงานที่มีอยู่แล้วจะยังไม่มีสิทธิ์นี้อัตโนมัติ ต้องไปติ๊กเปิดเอง ส่วนพนักงานใหม่จะได้ default)")
