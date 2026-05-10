'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';

interface Cert {
  id: string;
  displayNo: number;
  certType: string;
  fullName: string;
  fullNameDat: string | null;
  birthDate: string;
  groupName: string;
  targetOrg: string;
  status: string;
}

interface AcademicPeriod {
  start: string | null;
  end: string | null;
  orderDate: string | null;
  orderNumber: string | null;
  reason: string;
}

interface Lookup {
  found: boolean;
  course?: number | null;
  gradYear?: number | null;
  enrollDate?: string;
  orderNumber?: string;
  academicPeriods?: AcademicPeriod[];
}

export default function PrintCommonPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM']}>
      <PrintCommon />
    </Protected>
  );
}

function PrintCommon() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [cert, setCert] = useState<Cert | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<Cert>(`/api/certificates/${id}`).then(async (c) => {
      setCert(c);
      if (c.certType === 'STUDY') {
        try {
          const l = await apiFetch<Lookup>('/api/lookup/order', { query: { fullName: c.fullName } });
          setLookup(l);
        } catch {
          setLookup({ found: false });
        }
      } else {
        setLookup({ found: false });
      }
    });
  }, [id]);

  if (!cert) return null;
  const today = new Date();
  const birth = parseISO(cert.birthDate);
  const enroll = lookup?.enrollDate ? parseISO(lookup.enrollDate) : null;
  const gradDate = lookup?.gradYear ? new Date(lookup.gradYear, 5, 30) : null;

  return (
    <>
      <PrintShellStyles />
      <div className="print-toolbar">
        <button onClick={() => window.close()} className="btn btn--ghost btn--sm" type="button">Закрыть</button>
        <button onClick={() => window.print()} className="btn btn--primary btn--sm" type="button">Печать</button>
        {!lookup?.found && cert.certType === 'STUDY' && (
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            Сведения о приказе и курсе не подтянулись — поля можно заполнить вручную перед печатью.
          </span>
        )}
      </div>

      <div className="print-page">
        <div className="wrapper">
          <table className="doc-table">
            <tbody>
              <tr>
                <td className="header-block">
                  <p className="header-line"><b>Министерство образования и науки</b></p>
                  <p className="header-line"><b>Забайкальского края</b></p>
                  <p className="header-line"><b>Государственное профессиональное образовательное</b></p>
                  <p className="header-line"><b>учреждение</b></p>
                  <p className="header-line"><b>«Читинский техникум отраслевых технологий</b></p>
                  <p className="header-line"><b>и бизнеса»</b></p>
                  <p className="header-line"><b>(ГПОУ ЧТОТиБ)</b></p>
                  <p className="header-line"><b>_________________</b></p>
                  <p className="header-line">Бабушкина ул., д. 66, Чита,</p>
                  <p className="header-line">Забайкальский край, 672000.</p>
                  <p className="header-line">Тел./факс: (302-2) 28-20-84, 28-20-83, 32-06-18</p>
                  <p className="header-line">E-mail: 101103@mail.ru; Chtotib@mail.ru</p>
                  <p className="header-line">ОКПО 01266421, ОГРН 1027501147134</p>
                  <p className="header-line">ИНН/КПП 7536009015/753601001</p>
                </td>
                <td></td>
              </tr>

              <tr>
                <td className="header-block meta-row">
                  <span className="u u-mid"><b>{fmtDate(today)} г.</b></span>
                  <span>&nbsp;&nbsp;<b>№</b>&nbsp;</span>
                  <span className="u u-short"><b>С-{cert.displayNo}</b></span>
                </td>
                <td></td>
              </tr>

              <tr><td colSpan={2} className="mt-2">&nbsp;</td></tr>
              <tr><td colSpan={2} className="title-row"><b>СПРАВКА</b></td></tr>

              <tr>
                <td colSpan={2} className="line mt-2 line-cell">
                  <span style={{ float: 'left' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Дана&nbsp;</span>
                  <span className="u u-long"><b>{cert.fullNameDat || cert.fullName}</b></span>
                  &nbsp;«<span className="u u-short"><b>{birth ? pad2(birth.getDate()) : '__'}</b></span>»&nbsp;
                  <span className="u u-short"><b>{birth ? pad2(birth.getMonth() + 1) : '__'}</b></span>&nbsp;
                  <span className="u u-mid"><b>{birth ? birth.getFullYear() : '____'}</b></span>&nbsp;г.р.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  том, что он (а) обучается на&nbsp;
                  <span className="u u-short"><b>{lookup?.course ?? '_'}</b></span>
                  &nbsp;курсе по очной форме в ГПОУ «Читинский техникум отраслевых технологий
                  и бизнеса» за счет бюджетных ассигнований краевого бюджета Забайкальского края.
                </td>
              </tr>

              <tr><td colSpan={2} className="mt-2">&nbsp;</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  Зачислен (а) в число студентов с «<span className="u u-short"><b>{enroll ? pad2(enroll.getDate()) : '__'}</b></span>»&nbsp;
                  <span className="u u-short"><b>{enroll ? pad2(enroll.getMonth() + 1) : '__'}</b></span>&nbsp;
                  <span className="u u-mid"><b>{enroll ? enroll.getFullYear() : '____'}</b></span>&nbsp;г.,
                  приказ о зачислении №&nbsp;
                  <span className="u u-mid"><b>{lookup?.orderNumber ?? '______'}</b></span>
                  &nbsp;от «<span className="u u-short"><b>{enroll ? pad2(enroll.getDate()) : '__'}</b></span>»&nbsp;
                  <span className="u u-short"><b>{enroll ? pad2(enroll.getMonth() + 1) : '__'}</b></span>&nbsp;
                  <span className="u u-mid"><b>{enroll ? enroll.getFullYear() : '____'}</b></span>&nbsp;г.
                </td>
              </tr>

              {/* Академические отпуска (если есть) — каждый сдвигает срок окончания на +1 уч. год. */}
              {(lookup?.academicPeriods ?? []).map((p, i) => {
                const ps = parseISO(p.start);
                const pe = parseISO(p.end);
                const po = parseISO(p.orderDate);
                return (
                  <tr key={`ac-${i}`}>
                    <td colSpan={2} className="line mt-1 line-cell text-justify">
                      Предоставлен академический отпуск
                      {p.reason && <>&nbsp;по&nbsp;<span className="u u-long"><b>{p.reason}</b></span></>}
                      {ps && (
                        <>
                          &nbsp;с «<span className="u u-short"><b>{pad2(ps.getDate())}</b></span>»&nbsp;
                          <span className="u u-short"><b>{pad2(ps.getMonth() + 1)}</b></span>&nbsp;
                          <span className="u u-mid"><b>{ps.getFullYear()}</b></span>&nbsp;г.
                        </>
                      )}
                      {pe && (
                        <>
                          &nbsp;по «<span className="u u-short"><b>{pad2(pe.getDate())}</b></span>»&nbsp;
                          <span className="u u-short"><b>{pad2(pe.getMonth() + 1)}</b></span>&nbsp;
                          <span className="u u-mid"><b>{pe.getFullYear()}</b></span>&nbsp;г.
                        </>
                      )}
                      , приказ №&nbsp;
                      <span className="u u-mid"><b>{p.orderNumber ?? '______'}</b></span>
                      &nbsp;от «<span className="u u-short"><b>{po ? pad2(po.getDate()) : '__'}</b></span>»&nbsp;
                      <span className="u u-short"><b>{po ? pad2(po.getMonth() + 1) : '__'}</b></span>&nbsp;
                      <span className="u u-mid"><b>{po ? po.getFullYear() : '____'}</b></span>&nbsp;г.
                    </td>
                  </tr>
                );
              })}

              <tr>
                <td colSpan={2} className="line mt-1 line-cell">
                  Срок окончания учебного заведения&nbsp;«<span className="u u-short"><b>{gradDate ? pad2(gradDate.getDate()) : '30'}</b></span>»&nbsp;июня&nbsp;
                  <span className="u u-mid"><b>{gradDate ? gradDate.getFullYear() : '____'}</b></span>&nbsp;г.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  Справка выдана для предъявления по месту требования.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify small">
                  Лицензия на ведение образовательной деятельности по образовательным программам
                  № Л035-01052-75/001873983 от 08 июня 2016 г., бессрочно.
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify small">
                  Свидетельство о государственной аккредитации регистрационный № А007-01052-75/01150744
                  от 21.06.2018 г., бессрочно.
                </td>
              </tr>

              <tr><td colSpan={2} className="mt-2">&nbsp;</td></tr>

              <tr>
                <td colSpan={2} className="sign-block">
                  Директор ГПОУ «ЧТОТиБ»
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  Ж.В. Терукова
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PrintShellStyles() {
  return (
    <style jsx global>{`
      @page { size: A4; margin: 25mm 25mm 25mm 30mm; }
      .print-toolbar {
        position: sticky; top: 0; z-index: 10;
        display: flex; gap: var(--s-3); align-items: center;
        padding: var(--s-3) var(--s-4); background: var(--ais-veil);
        border-bottom: 1px solid var(--ais-line);
      }
      @media print { .print-toolbar, .app-shell aside, .app-shell .app-header { display: none !important; } }
      @media print { body, .app-main { background: #fff !important; color: #000 !important; padding: 0 !important; } }

      .print-page {
        background: #fff; color: #000;
        font-family: "Times New Roman", serif; font-size: 10pt; line-height: 1.35;
        padding: 12mm 0 0;
      }
      .print-page .wrapper { width: 780px; margin: 0 auto; }
      .print-page .doc-table { width: 100%; border-collapse: collapse; border: none; font-size: 10pt; }
      .print-page .doc-table td { border: none; padding: 0; vertical-align: bottom; font-size: 10pt; }
      .print-page .header-block { width: 272px; padding: 0 5px 6mm 5px; }
      .print-page .header-line { text-align: center; font-size: 8pt; margin: 0; }
      .print-page .header-line + .header-line { margin-top: 1px; }
      .print-page .u { display: inline-block; border-bottom: 1px solid #000; padding: 0 4px; line-height: 1.1; min-width: 30px; text-align: center; }
      .print-page .u-long { min-width: 360px; text-align: center; }
      .print-page .u-mid { min-width: 70px; }
      .print-page .u-short { min-width: 30px; }
      .print-page .meta-row { font-size: 8pt; text-align: center; padding-top: 4px; padding-bottom: 6mm; font-weight: bold; }
      .print-page .title-row { padding-top: 10px; padding-bottom: 6mm; text-align: center; font-weight: bold; font-size: 10pt; }
      .print-page .line { font-size: 10pt; }
      .print-page .text-justify { text-align: justify; }
      .print-page .mt-1 { margin-top: 4px; }
      .print-page .mt-2 { margin-top: 8px; }
      .print-page .line-cell { padding-top: 2px; }
      .print-page .sign-block { text-align: right; padding-top: 10mm; font-size: 10pt; font-weight: bold; }
      .print-page .small { font-size: 8pt !important; }
    `}</style>
  );
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function fmtDate(d: Date): string { return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
