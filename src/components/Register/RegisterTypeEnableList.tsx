import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSOCIATION_REGISTER_TYPES,
  GENERAL_REGISTER_TYPES,
  RegisterDocumentType,
} from '../../types/register';
import { registerTypeDescription, registerTypeShortTitle, registerTypeTitle } from '../../utils/registerI18n';

interface RegisterTypeEnableListProps {
  enabledTypes: RegisterDocumentType[];
  onToggle: (type: RegisterDocumentType) => void;
  compact?: boolean;
}

const RegisterTypeEnableList: React.FC<RegisterTypeEnableListProps> = ({
  enabledTypes,
  onToggle,
  compact = false,
}) => {
  const { t } = useTranslation();

  const renderGroup = (label: string, types: RegisterDocumentType[]) => (
    <>
      <small>{label}</small>
      <div className={compact ? 'register-type-enable' : 'pdf-type-enable'}>
        {types.map((type) => (
          <label key={type} className={enabledTypes.includes(type) ? 'is-on' : ''}>
            <input
              type="checkbox"
              checked={enabledTypes.includes(type)}
              onChange={() => onToggle(type)}
            />
            <span>
              <strong>
                {compact ? registerTypeShortTitle(type) : registerTypeTitle(type)}
              </strong>
              {!compact && (
                <small>
                  {registerTypeDescription(type)}
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
    </>
  );

  return (
    <div className={compact ? 'register-type-enable-group' : 'pdf-type-enable-group'}>
      {renderGroup(t('register.groupAssociation'), ASSOCIATION_REGISTER_TYPES)}
      {renderGroup(t('register.groupGeneral'), GENERAL_REGISTER_TYPES)}
    </div>
  );
};

export default RegisterTypeEnableList;
