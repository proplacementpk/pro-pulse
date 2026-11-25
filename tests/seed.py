"""Fills the local test database with sample people and roles, then serves a stand-in for
Supabase on port 54400 so the web portal can be run and tested without touching the real project.

    /home/claude/propulse/.venv/bin/python tests/seed.py
"""
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[2] / "propulse"
sys.path.insert(0, str(DESKTOP))
sys.path.insert(0, str(DESKTOP / "tests"))

import psycopg  # noqa: E402
import fake_supabase  # noqa: E402
from propulse.backend.demo import PEOPLE  # noqa: E402
from propulse.backend.service import Backend  # noqa: E402

PORT = 54400
TITLES = [("Quality Assurance Officer", ["HACCP", "ISO 22000", "Audits", "Lab testing"]),
          ("Production Supervisor", ["Filling lines", "Shift planning", "HACCP", "5S"]),
          ("Supply Chain Executive", ["Planning", "SAP B1", "Cold chain", "Excel"]),
          ("Maintenance Engineer", ["PLC", "Utilities", "Preventive maintenance", "UHT processing"]),
          ("Sales Officer", ["Distribution", "Trade marketing", "Negotiation"]),
          ("HR Business Partner", ["Recruitment", "Payroll", "Labour law"]),
          ("Food Technologist", ["Product development", "UHT processing", "Sensory", "HACCP"]),
          ("Warehouse Manager", ["Cold chain", "Inventory", "WMS", "Team leadership"])]
CITIES = ["Karachi", "Lahore", "Hyderabad", "Faisalabad", "Islamabad", "Multan"]
FIRST = ["Ali", "Sara", "Hamza", "Maryam", "Danish", "Noor", "Faisal", "Iqra", "Kamran", "Rabia", "Saad", "Mehwish", "Tariq", "Anum"]
LAST = ["Hussain", "Siddiqui", "Mirza", "Baig", "Chaudhry", "Rehman", "Javed", "Aslam"]
NOTICE = ["Immediate", "1 month", "2 months", "3 months"]


def main():
    fake_supabase.reset_database()
    server, url = fake_supabase.start(PORT)
    admin = Backend(url, "pk")
    admin.sign_up("farah@example.com", "password1", "Farah Siddiqui")
    for email, name, pw in (("sana@example.com", "Sana Malik", "password2"), ("omar@example.com", "Omar New", "password3")):
        admin.create_user(email, name, pw)
    users = {u["email"]: u for u in admin.list_users()}
    admin.update_user(users["sana@example.com"]["id"], {"active": True})
    sana = Backend(url, "pk")
    sana.sign_in("sana@example.com", "password2")

    ids = {}
    for name, title, company, city, yrs, edu, skills, summary in PEOPLE:
        ids[name] = sana.save_candidate({
            "full_name": name, "current_title": title, "current_company": company, "city": city, "country": "Pakistan",
            "total_experience_years": yrs, "highest_education": edu, "skills": skills, "summary": summary,
            "email": name.lower().replace(" ", ".") + "@example.com", "phone": "+92 300 5550" + str(100 + len(ids)),
            "linkedin_url": "linkedin.com/in/" + name.lower().replace(" ", "-"),
            "expected_salary": "PKR 450,000", "notice_period": "1 month",
            "experience": [{"job_title": title, "company": company, "start_date": "Mar 2019", "end_date": "Present",
                            "location": city, "description": summary},
                           {"job_title": "Assistant " + title, "company": "Earlier employer", "start_date": "Jan 2015", "end_date": "Feb 2019"}],
            "education": [{"degree": edu, "institution": "University of Karachi", "end_year": "2014"}]})
    n = 0
    for i in range(57):
        title, skills = TITLES[i % len(TITLES)]
        name = f"{FIRST[i % len(FIRST)]} {LAST[(i * 3) % len(LAST)]}" + ("" if i < 14 else f" {chr(65 + i % 26)}.")
        ids[name + str(i)] = sana.save_candidate({
            "full_name": name, "current_title": title, "current_company": ["Food company", "Dairy plant", "FMCG distributor", "Beverage manufacturer"][i % 4],
            "city": CITIES[i % len(CITIES)], "country": "Pakistan", "total_experience_years": [1, 2, 3, 4, 5, 5.5, 6, 7, 8, 10, 12, 15, 18][i % 13],
            "highest_education": ["BSc", "MBA", "BE", "DAE", "MSc"][i % 5], "skills": skills,
            "notice_period": NOTICE[i % 4], "candidate_status": ["Active", "Active", "Active", "Placed", "Not available", "Do not contact"][i % 6],
            "review_status": "Unreviewed" if i % 4 == 0 else "Reviewed",
            "summary": f"{title} with experience in {', '.join(skills[:2]).lower()}."})
        n += 1

    roles = {}
    for title, dept, loc, status, who in (("Plant Manager, Karachi", "Operations", "Karachi", "Open", "sana@example.com"),
                                          ("Production Head, Lahore", "Operations", "Lahore", "Open", "sana@example.com"),
                                          ("Area Sales Manager", "Sales", "Karachi", "On hold", "farah@example.com")):
        roles[title] = admin.save_role({"title": title, "department": dept, "location": loc, "status": status,
                                        "assigned_to": users[who]["id"], "description": f"{title} for a dairy company."})
    stages = {s["name"]: s["id"] for s in admin.list_stages()}
    sana.add_to_role(roles["Plant Manager, Karachi"], [ids[x] for x in ("Ayesha Khan", "Bilal Ahmed", "Hina Raza", "Usman Tariq")])
    sana.add_to_role(roles["Production Head, Lahore"], [ids["Usman Tariq"], ids["Bilal Ahmed"]])
    pm = {m["full_name"]: m["rc_id"] for m in sana.get_role(roles["Plant Manager, Karachi"])["members"]}
    sana.set_stage([pm["Ayesha Khan"]], stages["Interview"])
    sana.set_stage([pm["Bilal Ahmed"]], stages["Called"])
    sana.add_note(ids["Ayesha Khan"], "Spoke on the phone. Open to a move within Karachi, expects PKR 450,000.", roles["Plant Manager, Karachi"])
    sana.flush_audit()
    admin.flush_audit()
    old = datetime.now(timezone.utc) - timedelta(days=400)
    with psycopg.connect(fake_supabase.DSN, autocommit=True) as c:
        c.execute("update public.candidates set created_at = %s where full_name in ('Imran Sheikh', 'Zainab Qureshi')", [old])
        c.execute("insert into public.resumes (candidate_id, original_file_name, drive_file_id, drive_link, file_type, file_size, uploaded_by) "
                  "values (%s, 'Ayesha_Khan_CV.pdf', 'drive-file-1', 'https://drive.example/file/1', 'pdf', 184000, %s), "
                  "(%s, 'Bilal_Ahmed_CV.docx', null, 'https://drive.example/file/2', 'docx', 92000, %s)",
                  [ids["Ayesha Khan"], users["sana@example.com"]["id"], ids["Bilal Ahmed"], users["sana@example.com"]["id"]])
        c.execute("insert into public.app_settings (key, value, is_secret) values ('drive.shared_drive_id', 'drive-123', false), "
                  "('brevo.sender_email', 'desk@example.com', false), ('brevo.sender_name', 'Propulse Desk', false) "
                  "on conflict (key) do update set value = excluded.value")
    print(f"READY {url} candidates={len(ids)} roles={len(roles)}", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
