"use client";
// facha-ui lab · direction preview · removed by /facha-ui:init system once the system is written
import styles from "./lab-specimen.module.css";

/**
 * The specimen of a generated design system (B-026, SPEC §2.h): every role and state, drawn only
 * with the system's tokens, so each direction in <lab.dir>/system/directions.css can be seen as a
 * whole before choosing one. States that need interaction (hover, focus) are shown fixed.
 */

const COLORS: [string, string][] = [
  ["Fondo", styles.swBackground!],
  ["Panel", styles.swPanel!],
  ["Muted", styles.swMuted!],
  ["Texto", styles.swForeground!],
  ["Texto secundario", styles.swMutedForeground!],
  ["Borde", styles.swBorder!],
  ["Borde de controles", styles.swBorderStrong!],
  ["Foco", styles.swRing!],
  ["Acento", styles.swPrimary!],
  ["Acento hover", styles.swPrimaryHover!],
  ["Acento suave", styles.swPrimarySubtle!],
  ["Texto de acento", styles.swPrimaryStrong!],
];

const STATES: [string, string, string][] = [
  ["Éxito", "Entregado", styles.success!],
  ["Advertencia", "Pendiente", styles.warning!],
  ["Peligro", "Cancelado", styles.danger!],
  ["Información", "Enviado", styles.info!],
];

const TYPE: [string, string][] = [
  ["3xl", styles.text3xl!],
  ["2xl", styles.text2xl!],
  ["xl", styles.textXl!],
  ["lg", styles.textLg!],
  ["base", styles.textBase!],
  ["sm", styles.textSm!],
  ["xs", styles.textXs!],
];

export function LabSpecimen() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Muestra del sistema</h1>
        <p className={styles.lead}>Cada color, tamaño, radio y sombra de esta página sale de un token del sistema propuesto.</p>
      </header>

      <section className={styles.section} aria-labelledby="sp-type">
        <h2 id="sp-type" className={styles.heading}>Tipografía</h2>
        <div className={styles.stack}>
          {TYPE.map(([name, cls]) => (
            <p key={name} className={`${styles.sample} ${cls}`}>
              <span className={styles.label}>{name}</span> Pedidos de la semana
            </p>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-color">
        <h2 id="sp-color" className={styles.heading}>Color</h2>
        <div className={styles.swatches}>
          {COLORS.map(([name, cls]) => (
            <div key={name} className={styles.swatch}>
              <span className={`${styles.chip} ${cls}`} />
              <span className={styles.label}>{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-actions">
        <h2 id="sp-actions" className={styles.heading}>Acciones</h2>
        <div className={styles.row}>
          <button type="button" className={styles.primary}>Guardar</button>
          <button type="button" className={`${styles.primary} ${styles.isHover}`}>Guardar (hover)</button>
          <button type="button" className={`${styles.primary} ${styles.isFocus}`}>Guardar (foco)</button>
          <button type="button" className={styles.primary} disabled>Guardar (deshabilitado)</button>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.secondary}>Ver detalle</button>
          <button type="button" className={styles.dangerButton}>Eliminar</button>
          <a className={styles.link} href="#sp-surfaces">Ver todos los pedidos</a>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-fields">
        <h2 id="sp-fields" className={styles.heading}>Campos</h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nombre</span>
            <input className={styles.input} defaultValue="Ana Pérez" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Con foco</span>
            <input className={`${styles.input} ${styles.isFocus}`} defaultValue="Buscando" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Correo</span>
            <input className={`${styles.input} ${styles.inputError}`} defaultValue="ana@" aria-invalid="true" aria-describedby="sp-email-error" />
            <span id="sp-email-error" className={styles.fieldError}>Falta el dominio: escribilo como nombre@empresa.com.</span>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Deshabilitado</span>
            <input className={styles.input} defaultValue="No editable" disabled />
          </label>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-states">
        <h2 id="sp-states" className={styles.heading}>Estados</h2>
        <div className={styles.row}>
          {STATES.map(([kind, text, cls]) => (
            <span key={kind} className={`${styles.status} ${cls}`}>
              <span className={styles.statusDot} aria-hidden="true" />
              {text}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-surfaces">
        <h2 id="sp-surfaces" className={styles.heading}>Superficies</h2>
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Cliente</th>
                <th scope="col" className={styles.num}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#1042</td>
                <td>Ana Pérez</td>
                <td className={styles.num}>$ 12.400</td>
              </tr>
              <tr className={styles.selected}>
                <td>#1043</td>
                <td>Luis Gómez</td>
                <td className={styles.num}>$ 8.150</td>
              </tr>
              <tr>
                <td>#1044</td>
                <td>Sara Díaz</td>
                <td className={styles.num}>$ 3.900</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.fields}>
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Todavía no hay pedidos</p>
            <p className={styles.emptyText}>Cuando entre el primero, va a aparecer acá.</p>
            <button type="button" className={styles.secondary}>Crear un pedido</button>
          </div>
          <div className={styles.alert} role="alert">
            <p className={styles.alertTitle}>No se pudieron cargar los pedidos</p>
            <p className={styles.alertText}>Revisá la conexión y probá de nuevo.</p>
            <button type="button" className={styles.dangerButton}>Reintentar</button>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sp-shape">
        <h2 id="sp-shape" className={styles.heading}>Radios y sombras</h2>
        <div className={styles.row}>
          <span className={`${styles.shape} ${styles.radiusXs}`}>xs</span>
          <span className={`${styles.shape} ${styles.radiusSm}`}>sm</span>
          <span className={`${styles.shape} ${styles.radiusMd}`}>md</span>
          <span className={`${styles.shape} ${styles.radiusLg}`}>lg</span>
          <span className={`${styles.shape} ${styles.radiusDefault}`}>por defecto</span>
          <span className={`${styles.shape} ${styles.shadowSm}`}>sombra sm</span>
          <span className={`${styles.shape} ${styles.shadowMd}`}>sombra md</span>
          <span className={`${styles.shape} ${styles.shadowLg}`}>sombra lg</span>
        </div>
      </section>
    </main>
  );
}
