import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Chrome,
  CheckCircle,
  Zap,
  Shield,
  Clock,
  ExternalLink
} from 'lucide-react';

export default function Extension() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Zap,
      title: t('pages.extension.feature1Title'),
      description: t('pages.extension.feature1Description')
    },
    {
      icon: Shield,
      title: t('pages.extension.feature2Title'),
      description: t('pages.extension.feature2Description')
    },
    {
      icon: Clock,
      title: t('pages.extension.feature3Title'),
      description: t('pages.extension.feature3Description')
    },
    {
      icon: CheckCircle,
      title: t('pages.extension.feature4Title'),
      description: t('pages.extension.feature4Description')
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 shadow-lg">
          <Chrome className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {t('pages.extension.title')}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('pages.extension.subtitle')}
        </p>
        <Badge variant="secondary" className="mt-4">
          {t('pages.extension.versionBadge')}
        </Badge>
      </div>

      {/* Download Section */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 rounded-2xl p-8 mb-12 border-2 border-blue-200 dark:border-blue-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('pages.extension.readyToAutomate')}
            </h2>
            <p className="text-muted-foreground">
              {t('pages.extension.downloadInstructions')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700"
              onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
            >
              <Download className="w-5 h-5 mr-2" />
              {t('pages.extension.downloadButton')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.open('/auto-apply', '_self')}
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              {t('pages.extension.getTokenButton')}
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
          {t('pages.extension.featuresSection')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-card rounded-2xl p-8 border">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
          {t('pages.extension.howItWorksSection')}
        </h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('pages.extension.step1Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('pages.extension.step1Description')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('pages.extension.step2Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('pages.extension.step2Description')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('pages.extension.step3Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('pages.extension.step3Description')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('pages.extension.step4Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('pages.extension.step4Description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
