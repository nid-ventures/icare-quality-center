import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
}

/**
 * Supprime les données de test créées par le scénario de création admin/médecin/planning.
 * Ordre de suppression respectant les foreign keys.
 */
export async function cleanupTestUsers(usernames: string[]) {
  const connection = await getConnection();
  const usernamePlaceholders = usernames.map(() => '?').join(',');

  try {
    // 1-6. Nettoyer les prsnl et leurs dépendances (via prsnl.username)
    const [prsnlRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM prsnl WHERE username IN (${usernamePlaceholders})`,
      usernames,
    );
    const prsnlIds = prsnlRows.map((r) => r.id);

    if (prsnlIds.length > 0) {
      const prsnlPlaceholders = prsnlIds.map(() => '?').join(',');

      // 1. Supprimer disponibility via planning
      const [planningRows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT id FROM planning WHERE caregiver_id IN (${prsnlPlaceholders})`,
        prsnlIds,
      );
      const planningIds = planningRows.map((r) => r.id);

      if (planningIds.length > 0) {
        const planningPlaceholders = planningIds.map(() => '?').join(',');
        await connection.execute(
          `DELETE FROM disponibility WHERE planning_id IN (${planningPlaceholders})`,
          planningIds,
        );
        console.log(`Disponibilités supprimées pour ${planningIds.length} planning(s).`);

        // 2. Supprimer planning
        await connection.execute(
          `DELETE FROM planning WHERE id IN (${planningPlaceholders})`,
          planningIds,
        );
        console.log(`${planningIds.length} planning(s) supprimé(s).`);
      }

      // 3. Supprimer prsnl_to_speciality
      await connection.execute(
        `DELETE FROM prsnl_to_speciality WHERE prsnl_id IN (${prsnlPlaceholders})`,
        prsnlIds,
      );

      // 4. Supprimer prsnl_to_role_ids
      await connection.execute(
        `DELETE FROM prsnl_to_role_ids WHERE prsnl_id IN (${prsnlPlaceholders})`,
        prsnlIds,
      );

      // 5. Supprimer prsnl_to_hi
      await connection.execute(
        `DELETE FROM prsnl_to_hi WHERE prsnl_id IN (${prsnlPlaceholders})`,
        prsnlIds,
      );

      // 6. Supprimer prsnl
      await connection.execute(
        `DELETE FROM prsnl WHERE id IN (${prsnlPlaceholders})`,
        prsnlIds,
      );
      console.log(`${prsnlIds.length} prsnl supprimé(s).`);
    }

    // 7-8. Nettoyer user et person (via user.username)
    const [userRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM user WHERE username IN (${usernamePlaceholders})`,
      usernames,
    );
    const userIds = userRows.map((r) => r.id);

    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');

      // 7. Supprimer person
      await connection.execute(
        `DELETE FROM person WHERE id IN (${placeholders})`,
        userIds,
      );
      console.log(`${userIds.length} person(s) supprimée(s).`);

      // 8. Supprimer user
      await connection.execute(
        `DELETE FROM user WHERE id IN (${placeholders})`,
        userIds,
      );
      console.log(`${userIds.length} user(s) supprimé(s).`);
    }

    if (prsnlIds.length === 0 && userIds.length === 0) {
      console.log('Aucune donnée de test trouvée, rien à nettoyer.');
    } else {
      console.log('Nettoyage terminé avec succès.');
    }
  } finally {
    await connection.end();
  }
}
