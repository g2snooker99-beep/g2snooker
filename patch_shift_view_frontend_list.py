import shutil, sys

shutil.copy("templates/index.html", "templates/index.html.bak_shiftview2")

with open("templates/index.html", "r", encoding="utf-8") as f:
    src = f.read()

old = "  {key:'shift_close',    label:'ส่งกะ / ปิดจอ',                 group:'⚙️ ระบบ'},\n];"
new = "  {key:'shift_close',    label:'ส่งกะ / ปิดจอ',                 group:'⚙️ ระบบ'},\n  {key:'shift_view',     label:'ดูตารางงาน / ตารางกะ',          group:'👥 พนักงาน'},\n];"

if old not in src:
    print("❌ ไม่พบตำแหน่งเดิม - หยุดแก้")
    sys.exit(1)

src = src.replace(old, new, 1)
with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(src)

print("✅ เพิ่ม shift_view เข้า ALL_PERMS ใน templates/index.html แล้ว")
