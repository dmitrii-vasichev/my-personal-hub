import asyncio
import getpass
import logging
from datetime import datetime, timezone

from garminconnect import Garmin
from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.encryption import encrypt_value
from app.models.garmin import GarminConnection
from app.models.user import User
from app.services.garmin_auth import dump_garmin_tokens

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("garmin_local_login")

async def main():
    print("=== Garmin Local Login Override ===")
    print("This script will log in to Garmin using your local Mac's IP,")
    print("bypassing the Cloudflare block on your Railway server.")
    print("The generated tokens will be securely saved directly to your production database.\n")
    
    email = input("Garmin Email: ").strip()
    password = getpass.getpass("Garmin Password: ")
    
    if not email or not password:
        print("Email and password are required.")
        return

    print("\nAttempting to connect to Garmin SSO...")
    try:
        # Use local IP to pass Cloudflare
        client = Garmin(email, password)
        client.login()
        print("✅ Login successful! Tokens retrieved.")
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return

    tokens_data = dump_garmin_tokens(client)
    email_enc = encrypt_value(email)
    password_enc = encrypt_value(password)

    print("\nConnecting to production database...")
    async with async_session_factory() as db:
        # Get the first user (we assume there's only 1 admin user for the personal hub)
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("❌ No user found in the database. Please create a user first.")
            return
            
        result = await db.execute(
            select(GarminConnection).where(GarminConnection.user_id == user.id)
        )
        conn = result.scalar_one_or_none()
        
        if conn is None:
            conn = GarminConnection(
                user_id=user.id,
                email_encrypted=email_enc,
                password_encrypted=password_enc,
                sync_interval_minutes=240,
            )
            db.add(conn)
        else:
            conn.email_encrypted = email_enc
            conn.password_encrypted = password_enc
            
        conn.garth_tokens_encrypted = encrypt_value(tokens_data)
        conn.sync_status = "success"
        conn.connected_at = datetime.now(timezone.utc)
        conn.is_active = True
        conn.rate_limited_until = None
        conn.consecutive_failures = 0
        conn.sync_error = None
        
        await db.commit()
        print("✅ Garmin tokens successfully encrypted and saved to the database!")
        print("Your Railway backend will now use these tokens for future background syncs.")
        print("You can refresh the Vitals page in your browser. Connection is established.")

if __name__ == "__main__":
    asyncio.run(main())
