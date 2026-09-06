import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { CGI_REFERENCE_SUGGESTIONS } from '../../constants/associationFiscal';
import { AssociationConfig } from '../../types/association';
import {
  AssociationConfigService,
  defaultAssociationConfig,
} from '../../services/AssociationConfigService';
import { Logger } from '../../services/logger';
import SuggestInput from '../Common/SuggestInput';
import SignaturePad from '../Common/SignaturePad';

const IdentityAssociationPanel: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AssociationConfig>(defaultAssociationConfig());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void AssociationConfigService.getOrCreateConfig()
      .then(setConfig)
      .catch((err) => Logger.error('IdentityAssociationPanel.load', err));
  }, []);

  const patch = (partial: Partial<AssociationConfig>) => setConfig((c) => ({ ...c, ...partial }));

  const save = async () => {
    setSaving(true);
    try {
      await AssociationConfigService.saveConfig(config);
      toast.success(t('org.saved'));
    } catch (err) {
      Logger.error('IdentityAssociationPanel.save', err);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="org-split">
      <div className="org-form-scroll">
        <h3 className="org-section-title">{t('org.identityAsso')}</h3>
        <div className="org-grid">
          <label className="org-field">
            <span>{t('org.denomination')}</span>
            <input
              value={config.denominationSociale}
              onChange={(e) => patch({ denominationSociale: e.target.value })}
            />
          </label>
          <label className="org-field full">
            <span>{t('org.objetSocial')}</span>
            <textarea
              value={config.objetSocial}
              onChange={(e) => patch({ objetSocial: e.target.value })}
            />
          </label>
          <label className="org-field">
            <span>RNA</span>
            <input value={config.rna ?? ''} onChange={(e) => patch({ rna: e.target.value })} />
          </label>
          <label className="org-field">
            <span>SIREN</span>
            <input value={config.siren ?? ''} onChange={(e) => patch({ siren: e.target.value })} />
          </label>
          <label className="org-field">
            <span>SIRET</span>
            <input value={config.siret ?? ''} onChange={(e) => patch({ siret: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.formeJuridique')}</span>
            <select value={config.formeJuridique ?? ''} onChange={(e) => patch({ formeJuridique: e.target.value })}>
              <option value="">{t('common.choose')}</option>
              <option value="Association loi 1901">{t('org.formeAsso1901')}</option>
              <option value="Association reconnue d’utilité publique">{t('org.formeAssoRup')}</option>
              <option value="Fondation reconnue d’utilité publique">{t('org.formeFondationRup')}</option>
              <option value="Fonds de dotation">{t('org.formeFondsDotation')}</option>
              <option value="Autre">{t('org.formeAutre')}</option>
            </select>
          </label>
          <label className="org-field">
            <span>{t('org.dateCreation')}</span>
            <input type="date" value={config.dateCreation ?? ''} onChange={(e) => patch({ dateCreation: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.prefecture')}</span>
            <input value={config.prefectureDeclaration ?? ''} onChange={(e) => patch({ prefectureDeclaration: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.numeroRecepisse')}</span>
            <input value={config.numeroRecepisse ?? ''} onChange={(e) => patch({ numeroRecepisse: e.target.value })} />
          </label>
          <label className="org-field full">
            <span>{t('org.rue')}</span>
            <input
              value={config.adresse.rue}
              onChange={(e) => patch({ adresse: { ...config.adresse, rue: e.target.value } })}
            />
          </label>
          <label className="org-field">
            <span>{t('org.cp')}</span>
            <input
              value={config.adresse.codePostal}
              onChange={(e) =>
                patch({ adresse: { ...config.adresse, codePostal: e.target.value } })
              }
            />
          </label>
          <label className="org-field">
            <span>{t('org.ville')}</span>
            <input
              value={config.adresse.ville}
              onChange={(e) => patch({ adresse: { ...config.adresse, ville: e.target.value } })}
            />
          </label>
          <label className="org-field">
            <span>{t('org.country')}</span>
            <input value={config.adresse.pays} onChange={(e) => patch({ adresse: { ...config.adresse, pays: e.target.value } })} />
          </label>
          <label className="org-field">
            <span>{t('org.email')}</span>
            <input type="email" value={config.email ?? ''} onChange={(e) => patch({ email: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.tel')}</span>
            <input value={config.telephone ?? ''} onChange={(e) => patch({ telephone: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.website')}</span>
            <input value={config.siteWeb ?? ''} onChange={(e) => patch({ siteWeb: e.target.value })} />
          </label>
          <label className="org-field">
            <span>{t('org.signataire')}</span>
            <input
              value={config.signataireNom ?? ''}
              onChange={(e) => patch({ signataireNom: e.target.value })}
            />
          </label>
          <label className="org-field">
            <span>{t('org.qualite')}</span>
            <input
              value={config.signataireQualite ?? ''}
              onChange={(e) => patch({ signataireQualite: e.target.value })}
            />
          </label>
          <div className="org-field full">
            <span>{t('org.signatureElectronique')}</span>
            <p className="ct-hint" style={{ marginBottom: 8 }}>{t('org.signatureElectroniqueHint')}</p>
            <SignaturePad
              value={config.signataireSignature ?? null}
              onChange={(image) => patch({ signataireSignature: image ?? undefined })}
            />
          </div>
          <label className="org-field full flex-row items-center gap-2" style={{ display: 'flex', flexDirection: 'row' }}>
            <input
              type="checkbox"
              checked={Boolean(config.statutOIG)}
              onChange={(e) => patch({ statutOIG: e.target.checked })}
            />
            <span>{t('org.oig')}</span>
          </label>
          <label className="org-field">
            <span>{t('org.dateJoafe')}</span>
            <input type="date" value={config.datePublicationJO ?? ''} onChange={(e) => patch({ datePublicationJO: e.target.value })} />
          </label>
          <div className="org-field full">
            <span>{t('org.fiscalRefs')}</span>
            <SuggestInput
              value={config.referencesCGI ?? ''}
              onChange={(value) => patch({ referencesCGI: value })}
              suggestions={[...CGI_REFERENCE_SUGGESTIONS]}
              showAllOnFocus
              placeholder={t('org.fiscalRefsPlaceholder')}
              emptyLabel={t('org.suggestManual')}
            />
          </div>
          <label className="org-field">
            <span>{t('org.nextReceiptNumber')}</span>
            <input type="number" min={0} value={config.nextReceiptNumber ?? 0} onChange={(e) => patch({ nextReceiptNumber: Math.max(0, Number(e.target.value)) })} />
          </label>
        </div>
        <div className="mt-4">
          <button className="ct-btn-primary" type="button" disabled={saving} onClick={() => void save()}>
            {t('common.save')}
          </button>
        </div>
      </div>
      <aside className="org-preview">
        <div className="org-preview-sheet">
          <strong>{config.denominationSociale || t('org.previewEmpty')}</strong>
          <p>{config.objetSocial}</p>
          <p>RNA {config.rna}</p>
          <p>
            {config.signataireNom} {config.signataireQualite}
          </p>
        </div>
      </aside>
    </div>
  );
};

export default IdentityAssociationPanel;
