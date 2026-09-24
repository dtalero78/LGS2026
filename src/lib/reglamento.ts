import 'server-only';
import { spacesClient, SPACES_BUCKET } from './spaces';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * Reglamento de Participantes (DI-010) — el PDF que el alumno abre desde la
 * opción "Reglamentos" del header de su panel.
 *
 * Dónde vive: igual que las plantillas de certificados, hay DOS fuentes y gana
 * la de Spaces:
 *   1. `reglamentos/reglamento-participantes.pdf` en DO Spaces → la versión que
 *      se carga desde Mantenimiento › Avisos › Reglamentos. Publica al instante,
 *      sin desplegar.
 *   2. `public/reglamentos/reglamento-participantes.pdf` del repo → el respaldo.
 *      Es el que se sirve mientras nadie haya subido uno, y al que se vuelve si
 *      se borra el personalizado.
 */

export const REGLAMENTO_KEY = 'reglamentos/reglamento-participantes.pdf';

/** Ruta estática del PDF de respaldo que viaja en el repo. */
export const REGLAMENTO_ESTATICO = '/reglamentos/reglamento-participantes.pdf';

/** Nombre con el que se descarga, independiente de cómo se haya llamado el archivo subido. */
export const REGLAMENTO_FILENAME = 'Reglamento Participantes LGS.pdf';

export interface ReglamentoPersonalizado {
  size: number;
  lastModified: string | null;
}

/**
 * ¿Hay una versión cargada en Spaces? Devuelve sus metadatos, o `null` si
 * corresponde servir el PDF del repo.
 *
 * Nunca lanza: si Spaces no responde o falta credencial, se comporta como "no
 * hay personalizado" y el alumno igual recibe el reglamento del repo. Es
 * preferible servir una versión posiblemente vieja a dejarlo sin documento.
 */
export async function getReglamentoPersonalizado(): Promise<ReglamentoPersonalizado | null> {
  try {
    const head = await spacesClient.send(
      new HeadObjectCommand({ Bucket: SPACES_BUCKET, Key: REGLAMENTO_KEY }),
    );
    return {
      size: head.ContentLength ?? 0,
      lastModified: head.LastModified ? head.LastModified.toISOString() : null,
    };
  } catch {
    return null;
  }
}
