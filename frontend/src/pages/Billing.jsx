import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

const STRIPE_LINKS = {
  starter: 'https://buy.stripe.com/test_aFafZjdkJ8qGeGI092cMM02',
  growth: 'https://buy.stripe.com/test_00w14pbcB7mCgOQ052cMM03',
  pro: 'https://buy.stripe.com/test_5kQ6oJgwVgXc8ik6xqcMM01',
};

export default function Billing() {
  const { t } = useTranslation();

  const plans = [
    {
      name: 'Starter',
      price: '€15',
      description: t('pages.billing.plans.starter.description'),
      features: t('pages.billing.plans.starter.features', { returnObjects: true }),
      cta: t('pages.billing.plans.starter.cta'),
      recommended: false,
      stripeLink: STRIPE_LINKS.starter,
    },
    {
      name: 'Growth',
      price: '€30',
      description: t('pages.billing.plans.growth.description'),
      features: t('pages.billing.plans.growth.features', { returnObjects: true }),
      cta: t('pages.billing.plans.growth.cta'),
      recommended: true,
      stripeLink: STRIPE_LINKS.growth,
    },
    {
      name: 'Pro',
      price: '€89',
      description: t('pages.billing.plans.pro.description'),
      features: t('pages.billing.plans.pro.features', { returnObjects: true }),
      cta: t('pages.billing.plans.pro.cta'),
      recommended: false,
      stripeLink: STRIPE_LINKS.pro,
    },
  ];

  const handleSelect = (stripeLink) => {
    if (stripeLink) {
      window.open(stripeLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] py-16 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] tracking-tight mb-4">
          {t('pages.billing.title')}
        </h1>
        <p className="text-lg text-[#888] font-normal">
          {t('pages.billing.subtitle')}
        </p>
      </div>

      {/* Plans Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative bg-white rounded-xl border flex flex-col justify-between p-8 ${
              plan.recommended
                ? 'border-[#1a1a1a] shadow-sm'
                : 'border-[#e5e5e5]'
            }`}
          >
            {/* Recommended Badge */}
            {plan.recommended && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-block bg-[#1a1a1a] text-white text-[11px] font-semibold tracking-wider uppercase px-4 py-1.5 rounded-full">
                  {t('pages.billing.recommended')}
                </span>
              </div>
            )}

            <div>
              {/* Plan Name */}
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-5xl font-bold text-[#1a1a1a] tracking-tight">
                  {plan.price}
                </span>
                <span className="text-base text-[#888] font-normal">
                  {t('pages.billing.perMonth')}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-[#888] leading-relaxed mb-8">
                {plan.description}
              </p>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-[#555]"
                  >
                    <Check className="w-4 h-4 text-[#1a1a1a] mt-0.5 flex-shrink-0 stroke-[2.5]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => handleSelect(plan.stripeLink)}
              className="w-full bg-[#1a1a1a] text-white font-semibold text-sm py-3.5 rounded-lg hover:bg-[#333] transition-colors cursor-pointer"
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-[#888]">
        {t('pages.billing.trialDisclaimer')}
      </p>
    </div>
  );
}
