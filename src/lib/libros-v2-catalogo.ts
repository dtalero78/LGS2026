/**
 * Catálogo de los "New Books" v2 (BEGINNER / PRACTICAL / FUNCTIONAL, edición
 * revisada v2). Client-safe: solo metadatos, nunca contenido ni claves.
 *
 * Cada libro: su interruptor en Mantenimiento › New Books (APP_CONFIG), la
 * etapa académica que lo puede abrir (src/lib/etapas.ts) y la portada / paleta
 * del prototipo entregado con el paquete.
 */
import type { Etapa } from '@/lib/etapas';

export type SlugLibroV2 = 'beg' | 'pra' | 'func';

export interface LibroV2Meta {
  slug: SlugLibroV2;
  /** Código del libro en el paquete y en las tablas LIBRO_* */
  bookCode: string;
  /** Nombre visible del nivel */
  nivel: 'BEGINNER' | 'PRACTICAL' | 'FUNCTIONAL';
  /** Nombre en el menú de Mantenimiento › New Books */
  menu: string;
  /** Etapa que lo puede abrir (BN1-3 / P1-3 / F1-3) */
  etapa: Etapa;
  /** APP_CONFIG key del interruptor (nace apagado) */
  flagKey: string;
  headline: string;
  intro: string;
  accent: string;
  secondary: string;
  paper: string;
}

export const LIBROS_V2: Record<SlugLibroV2, LibroV2Meta> = {
  beg: {
    slug: 'beg',
    bookCode: 'LGS-BEGINNER-V2',
    nivel: 'BEGINNER',
    menu: 'Book BEG New',
    etapa: 'BEGINNER',
    flagKey: 'book_beg_new_activo',
    headline: 'Every friendship<br>starts with hello.',
    intro: 'Conoce a Clarice, Ethan y sus amigos mientras construyes tus primeras conversaciones en inglés.',
    accent: '#1263CC',
    secondary: '#F9E58D',
    paper: '#FFF9E4',
  },
  pra: {
    slug: 'pra',
    bookCode: 'LGS-PRACTICAL-V2',
    nivel: 'PRACTICAL',
    menu: 'Book PRA New',
    etapa: 'PRACTICAL',
    flagKey: 'book_pra_new_activo',
    headline: 'Real moments.<br>Real conversations.',
    intro: 'Acompaña a los personajes en sus citas, planes y decisiones cotidianas.',
    accent: '#1263CC',
    secondary: '#EAA2A0',
    paper: '#FFF3F1',
  },
  func: {
    slug: 'func',
    bookCode: 'LGS-FUNCTIONAL-V2',
    nivel: 'FUNCTIONAL',
    menu: 'Book FUNC New',
    etapa: 'FUNCTIONAL',
    flagKey: 'book_func_new_activo',
    headline: 'Your voice.<br>Your next chapter.',
    intro: 'Conecta ideas, comparte experiencias y acompaña a los personajes hasta el final de su historia.',
    accent: '#1263CC',
    secondary: '#BBD5F8',
    paper: '#F1F7FF',
  },
};

export function libroV2(slug: string | null | undefined): LibroV2Meta | null {
  return (slug && (LIBROS_V2 as Record<string, LibroV2Meta>)[slug]) || null;
}

export function libroV2PorEtapa(etapa: Etapa | null): LibroV2Meta | null {
  return Object.values(LIBROS_V2).find((l) => l.etapa === etapa) || null;
}
