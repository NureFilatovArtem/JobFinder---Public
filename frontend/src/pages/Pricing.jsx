import { CheckIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'

const tiers = [
    {
        name: 'Starter',
        id: 'tier-starter',
        href: 'https://buy.stripe.com/test_aFafZjdkJ8qGeGI092cMM02',
        priceMonthly: '€19.99',
        originalPrice: '€22.21',
        description: "The perfect plan if you're just getting started with auto-applying.",
        features: ['500 Auto-applies / month', 'Basic resume parsing', 'Standard support response time'],
        featured: false,
    },
    {
        name: 'Pro',
        id: 'tier-pro',
        href: 'https://buy.stripe.com/test_00w14pbcB7mCgOQ092cMM03',
        priceMonthly: '€24.99',
        originalPrice: '€27.77',
        description: 'Unlimited applying and advanced features for serious job seekers.',
        features: [
            'Unlimited auto-applies',
            'Advanced resume optimization',
            'Priority support',
            'Detailed analytics',
        ],
        featured: true,
    },
    {
        name: 'Fast',
        id: 'tier-fast',
        href: 'https://buy.stripe.com/test_5kQ6oJgwVgXc8ik6xqcMM01',
        priceMonthly: '€99.90',
        originalPrice: '€111.00',
        description: 'Maximum speed and priority for urgent job searches.',
        features: [
            'Unlimited auto-applies',
            'Highest priority processing',
            'Dedicated success manager',
            'Custom cover letter generation',
            'Multi-platform support',
        ],
        featured: false,
    },
]

function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

export default function Pricing() {
    const { t } = useTranslation();
    return (
        <div className="relative isolate bg-gray-900 px-6 py-24 sm:py-32 lg:px-8 min-h-screen">
            <div aria-hidden="true" className="absolute inset-x-0 -top-3 -z-10 transform-gpu overflow-hidden px-36 blur-3xl">
                <div
                    style={{
                        clipPath:
                            'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                    }}
                    className="mx-auto aspect-1155/678 w-288.75 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-20"
                />
            </div>
            <div className="mx-auto max-w-4xl text-center">
                <h2 className="text-base/7 font-semibold text-blue-400">{t('pages.pricing.label')}</h2>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-balance text-white sm:text-6xl">
                    {t('pages.pricing.title')}
                </p>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-pretty text-gray-400 sm:text-xl/8">
                {t('pages.pricing.subtitle')}
            </p>
            <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-4xl lg:grid-cols-3 gap-x-8">
                {tiers.map((tier, tierIdx) => (
                    <div
                        key={tier.id}
                        className={classNames(
                            tier.featured ? 'relative bg-gray-800 shadow-2xl scale-105 z-10' : 'bg-white/5 sm:mx-0',
                            'rounded-3xl p-8 ring-1 ring-white/10 sm:p-10 flex flex-col justify-between h-full',
                        )}
                    >
                        <div>
                            <div className="flex justify-between items-start">
                                <h3
                                    id={tier.id}
                                    className={classNames(tier.featured ? 'text-blue-400' : 'text-blue-400', 'text-base/7 font-semibold')}
                                >
                                    {tier.name}
                                </h3>
                                {/* Discount Badge */}
                                <span className="inline-flex items-center rounded-full bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20">
                                    {t('pages.pricing.discount')}
                                </span>
                            </div>

                            <p className="mt-4 flex items-baseline gap-x-2">
                                <span className="text-sm text-gray-500 line-through decoration-red-500/60 decoration-2 mr-2">
                                    {tier.originalPrice}
                                </span>
                                <span
                                    className={classNames(
                                        tier.featured ? 'text-white' : 'text-white',
                                        'text-5xl font-semibold tracking-tight',
                                    )}
                                >
                                    {tier.priceMonthly}
                                </span>
                                <span className={classNames(tier.featured ? 'text-gray-400' : 'text-gray-400', 'text-base')}>{t('pages.pricing.perMonth')}</span>
                            </p>
                            <p className={classNames(tier.featured ? 'text-gray-300' : 'text-gray-300', 'mt-6 text-base/7')}>
                                {tier.description}
                            </p>
                            <ul
                                role="list"
                                className={classNames(
                                    tier.featured ? 'text-gray-300' : 'text-gray-300',
                                    'mt-8 space-y-3 text-sm/6 sm:mt-10',
                                )}
                            >
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex gap-x-3">
                                        <CheckIcon
                                            aria-hidden="true"
                                            className={classNames(tier.featured ? 'text-blue-400' : 'text-blue-400', 'h-6 w-5 flex-none')}
                                        />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <a
                            href={tier.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-describedby={tier.id}
                            className={classNames(
                                tier.featured
                                    ? 'bg-blue-500 text-white hover:bg-blue-400 focus-visible:outline-blue-500'
                                    : 'bg-white/10 text-white inset-ring inset-ring-white/5 hover:bg-white/20 focus-visible:outline-white/75',
                                'mt-8 block rounded-md px-3.5 py-2.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-10',
                            )}
                        >
                            {t('pages.pricing.ctaButton')}
                        </a>
                    </div>
                ))}
            </div>
        </div>
    )
}
