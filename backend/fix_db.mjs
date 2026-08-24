import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_LYWoK2PA0Vzn@ep-orange-frog-ayrkhyh4-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const sql = neon(dbUrl);
  try {
    const servers = await sql\SELECT * FROM iptv_servers;\;
    console.log('Current DB Servers in Neon:', servers);

    if (servers.length === 0) {
      await sql\
        INSERT INTO iptv_servers (name, url, username, password, is_active, priority)
        VALUES ('Servidor Primario', 'http://superflash.ovh:80', 'astrotv0907', 'sYeTeAwMHy', true, 1);
      \;
    } else {
      await sql\
        UPDATE iptv_servers 
        SET url = 'http://superflash.ovh:80', 
            username = 'astrotv0907', 
            password = 'sYeTeAwMHy', 
            is_active = true;
      \;
    }

    const updated = await sql\SELECT * FROM iptv_servers;\;
    console.log('Updated DB Servers in Neon:', updated);
  } catch (err) {
    console.error('Error updating DB:', err);
  }
}

main();
