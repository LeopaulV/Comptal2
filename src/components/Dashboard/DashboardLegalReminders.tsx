import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, Info } from 'lucide-react';
import { LegalReminder } from '../../types/dashboard';
import { formatMoney } from '../../utils/amounts';
import { registerDateLocale, registerTypeTitle } from '../../utils/registerI18n';

interface DashboardLegalRemindersProps {
  reminders: LegalReminder[];
}

const ICONS = {
  urgent: AlertTriangle,
  warn: AlertTriangle,
  info: Info,
};

function reminderParams(
  reminder: LegalReminder,
  lang: string
): Record<string, string | number> {
  const locale = registerDateLocale(lang);
  const params: Record<string, string | number> = { ...(reminder.params ?? {}) };
  if (typeof params.amount === 'number') {
    params.amount = formatMoney(params.amount, locale);
  }
  if (reminder.registerType) {
    params.typeLabel = registerTypeTitle(reminder.registerType);
  }
  return params;
}

const DashboardLegalReminders: React.FC<DashboardLegalRemindersProps> = ({ reminders }) => {
  const { t, i18n } = useTranslation();
  if (reminders.length === 0) {
    return (
      <section className="dashboard-reminders dashboard-reminders-empty">
        <Bell size={16} />
        <p>{t('dashboard.reminders.empty')}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-reminders">
      <h2>
        <Bell size={16} />
        {t('dashboard.reminders.title')}
      </h2>
      <ul>
        {reminders.map((reminder) => {
          const Icon = ICONS[reminder.severity];
          const params = reminderParams(reminder, i18n.language);
          return (
            <li key={reminder.id} className={`dashboard-reminder is-${reminder.severity}`}>
              <Icon size={16} />
              <div>
                <strong>{t(reminder.titleKey, params)}</strong>
                <p>{t(reminder.detailKey, params)}</p>
              </div>
              <Link to={reminder.to} className="dashboard-reminder-link">
                {t('dashboard.reminders.open')}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DashboardLegalReminders;
