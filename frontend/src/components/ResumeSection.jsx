import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm, ConfirmDialog } from './ui/confirm-dialog';
import {
    FileText,
    Upload,
    Plus,
    Check,
    AlertCircle,
    Download,
    Trash2,
    Edit,
    ChevronDown,
    ChevronUp,
    Briefcase,
    GraduationCap,
    Award,
    Languages,
    X
} from 'lucide-react';
import { resumeAPI } from '../api/resume';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const StatusBadge = ({ status, message }) => {
    const config = {
        ready: {
            color: 'bg-green-100 text-green-800 border-green-200',
            icon: <Check className="w-4 h-4" />,
            label: 'Ready for auto-apply'
        },
        draft: {
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            icon: <Edit className="w-4 h-4" />,
            label: 'Draft - incomplete'
        },
        parsing_failed: {
            color: 'bg-red-100 text-red-800 border-red-200',
            icon: <AlertCircle className="w-4 h-4" />,
            label: 'Parsing failed'
        },
        generating: {
            color: 'bg-blue-100 text-blue-800 border-blue-200',
            icon: <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />,
            label: 'Generating...'
        },
        none: {
            color: 'bg-gray-100 text-gray-600 border-gray-200',
            icon: <FileText className="w-4 h-4" />,
            label: 'No resume'
        }
    };

    const cfg = config[status] || config.none;

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${cfg.color}`}>
            {cfg.icon}
            <span className="text-sm font-medium">{message || cfg.label}</span>
        </div>
    );
};

const ResumeSection = () => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [resume, setResume] = useState(null);
    const [status, setStatus] = useState('none');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [expandedSections, setExpandedSections] = useState({});
    const { openConfirm, dialogProps } = useConfirm();

    // Generator form state
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        location: '',
        linkedin_url: '',
        portfolio_url: '',
        summary: '',
        work_experience: [],
        education: [],
        skills: [],
        certifications: [],
        languages: []
    });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadResume();
    }, []);

    const loadResume = async () => {
        try {
            setLoading(true);
            const data = await resumeAPI.get();
            setStatus(data.status);
            setMessage(data.message);
            if (data.resume) {
                setResume(data.resume);
                // Populate form with existing data
                setFormData({
                    full_name: data.resume.full_name || '',
                    email: data.resume.email || '',
                    phone: data.resume.phone || '',
                    location: data.resume.location || '',
                    linkedin_url: data.resume.linkedin_url || '',
                    portfolio_url: data.resume.portfolio_url || '',
                    summary: data.resume.summary || '',
                    work_experience: data.resume.work_experience || [],
                    education: data.resume.education || [],
                    skills: data.resume.skills || [],
                    certifications: data.resume.certifications || [],
                    languages: data.resume.languages || []
                });
            }
        } catch (error) {
            console.error('Error loading resume:', error);
            if (error.response?.status === 401) {
                setStatus('none');
                setMessage('Please log in to manage your resume');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.warning('Please upload a PDF file');
            return;
        }

        try {
            setUploading(true);
            const data = await resumeAPI.upload(file);
            setStatus(data.status);
            setMessage(data.message);
            setResume(data.resume);
        } catch (error) {
            console.error('Error uploading resume:', error);
            setStatus('parsing_failed');
            setMessage(error.response?.data?.message || 'Failed to upload resume');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleGenerate = async () => {
        // Validate required fields
        if (!formData.full_name || !formData.email) {
            toast.warning('Please fill in at least your name and email');
            return;
        }

        try {
            setGenerating(true);
            const data = await resumeAPI.generate(formData);
            setStatus(data.status);
            setMessage(data.message);
            setResume(data.resume);
            setShowGenerator(false);
        } catch (error) {
            console.error('Error generating resume:', error);
            toast.error(error.response?.data?.message || 'Failed to generate resume');
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = () => {
        openConfirm({
            title: 'Delete Resume',
            description: 'Are you sure you want to delete your resume? This cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await resumeAPI.delete();
                    setResume(null);
                    setStatus('none');
                    setMessage('No resume');
                    setFormData({
                        full_name: '',
                        email: '',
                        phone: '',
                        location: '',
                        linkedin_url: '',
                        portfolio_url: '',
                        summary: '',
                        work_experience: [],
                        education: [],
                        skills: [],
                        certifications: [],
                        languages: []
                    });
                    toast.success('Resume deleted');
                } catch (error) {
                    console.error('Error deleting resume:', error);
                    toast.error('Failed to delete resume');
                }
            }
        });
    };

    const handleDownloadPDF = () => {
        const pdfUrl = resume?.generated_pdf_url || resume?.uploaded_pdf_url;
        if (pdfUrl) {
            window.open(`${API_URL}${pdfUrl}`, '_blank');
        }
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Form helpers
    const addWorkExperience = () => {
        setFormData(prev => ({
            ...prev,
            work_experience: [...prev.work_experience, {
                company: '',
                title: '',
                location: '',
                start_date: '',
                end_date: '',
                description: '',
                achievements: []
            }]
        }));
    };

    const updateWorkExperience = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            work_experience: prev.work_experience.map((exp, i) =>
                i === index ? { ...exp, [field]: value } : exp
            )
        }));
    };

    const removeWorkExperience = (index) => {
        setFormData(prev => ({
            ...prev,
            work_experience: prev.work_experience.filter((_, i) => i !== index)
        }));
    };

    const addEducation = () => {
        setFormData(prev => ({
            ...prev,
            education: [...prev.education, {
                institution: '',
                degree: '',
                field: '',
                start_date: '',
                end_date: '',
                gpa: ''
            }]
        }));
    };

    const updateEducation = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            education: prev.education.map((edu, i) =>
                i === index ? { ...edu, [field]: value } : edu
            )
        }));
    };

    const removeEducation = (index) => {
        setFormData(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
    };

    const handleSkillsChange = (e) => {
        const skillsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s);
        setFormData(prev => ({ ...prev, skills: skillsArray }));
    };

    const handleLanguagesChange = (e) => {
        const langsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s);
        setFormData(prev => ({ ...prev, languages: langsArray }));
    };

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <>
        <ConfirmDialog {...dialogProps} />
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-lg shadow-sm p-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Resume</h2>
                        <p className="text-sm text-gray-500">Your canonical resume for auto-apply</p>
                    </div>
                </div>
                <StatusBadge status={status} message={message} />
            </div>

            {/* Resume exists - show info */}
            {resume && status !== 'none' && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-800">{resume.full_name || 'Your Resume'}</h3>
                            {resume.email && <p className="text-sm text-gray-600">{resume.email}</p>}
                            {resume.phone && <p className="text-sm text-gray-600">{resume.phone}</p>}
                            {resume.location && <p className="text-sm text-gray-600">{resume.location}</p>}
                            <p className="text-xs text-gray-400 mt-2">
                                Last updated: {new Date(resume.updated_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {(resume.generated_pdf_url || resume.uploaded_pdf_url) && (
                                <button
                                    onClick={handleDownloadPDF}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Download PDF"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowGenerator(true)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                title="Edit Resume"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete Resume"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Canonical text preview */}
                    {resume.canonical_text && (
                        <div className="mt-4">
                            <button
                                onClick={() => toggleSection('preview')}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                                {expandedSections.preview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {expandedSections.preview ? 'Hide' : 'Show'} canonical text
                            </button>
                            <AnimatePresence>
                                {expandedSections.preview && (
                                    <motion.pre
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-2 p-3 bg-white border border-gray-200 rounded text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64"
                                    >
                                        {resume.canonical_text}
                                    </motion.pre>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )}

            {/* Actions - Upload or Generate */}
            {!showGenerator && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Upload PDF */}
                    <div className="relative">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Upload className="w-8 h-8 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-700">
                                {uploading ? 'Uploading...' : 'Upload PDF Resume'}
                            </span>
                            <span className="text-xs text-gray-500">
                                PDF will be parsed to extract text
                            </span>
                        </button>
                    </div>

                    {/* Generate Resume */}
                    <button
                        onClick={() => setShowGenerator(true)}
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition flex flex-col items-center gap-2"
                    >
                        <Plus className="w-8 h-8 text-gray-400" />
                        <span className="font-medium text-gray-700">
                            {resume ? 'Edit Resume' : 'Create Resume'}
                        </span>
                        <span className="text-xs text-gray-500">
                            Build your resume step by step
                        </span>
                    </button>
                </div>
            )}

            {/* Resume Generator Form */}
            <AnimatePresence>
                {showGenerator && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 border-t border-gray-200 pt-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Resume Builder</h3>
                            <button
                                onClick={() => setShowGenerator(false)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Personal Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Full Name *"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email *"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Location (City, Country)"
                                        value={formData.location}
                                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="url"
                                        placeholder="LinkedIn URL"
                                        value={formData.linkedin_url}
                                        onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="url"
                                        placeholder="Portfolio URL"
                                        value={formData.portfolio_url}
                                        onChange={(e) => setFormData(prev => ({ ...prev, portfolio_url: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <textarea
                                    placeholder="Professional Summary"
                                    value={formData.summary}
                                    onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Work Experience */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4" />
                                        Work Experience
                                    </h4>
                                    <button
                                        onClick={addWorkExperience}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                                {formData.work_experience.map((exp, index) => (
                                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <span className="text-sm font-medium text-gray-600">Experience #{index + 1}</span>
                                            <button
                                                onClick={() => removeWorkExperience(index)}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Job Title"
                                                value={exp.title}
                                                onChange={(e) => updateWorkExperience(index, 'title', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Company"
                                                value={exp.company}
                                                onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Location"
                                                value={exp.location}
                                                onChange={(e) => updateWorkExperience(index, 'location', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Start Date"
                                                    value={exp.start_date}
                                                    onChange={(e) => updateWorkExperience(index, 'start_date', e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="End Date"
                                                    value={exp.end_date}
                                                    onChange={(e) => updateWorkExperience(index, 'end_date', e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <textarea
                                            placeholder="Description / Responsibilities"
                                            value={exp.description}
                                            onChange={(e) => updateWorkExperience(index, 'description', e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Education */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                        <GraduationCap className="w-4 h-4" />
                                        Education
                                    </h4>
                                    <button
                                        onClick={addEducation}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                                {formData.education.map((edu, index) => (
                                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <span className="text-sm font-medium text-gray-600">Education #{index + 1}</span>
                                            <button
                                                onClick={() => removeEducation(index)}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Institution"
                                                value={edu.institution}
                                                onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Degree"
                                                value={edu.degree}
                                                onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Field of Study"
                                                value={edu.field}
                                                onChange={(e) => updateEducation(index, 'field', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Start"
                                                    value={edu.start_date}
                                                    onChange={(e) => updateEducation(index, 'start_date', e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="End"
                                                    value={edu.end_date}
                                                    onChange={(e) => updateEducation(index, 'end_date', e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Skills */}
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                    <Award className="w-4 h-4" />
                                    Skills
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Skills (comma-separated): JavaScript, React, Node.js, Python..."
                                    value={formData.skills.join(', ')}
                                    onChange={handleSkillsChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Languages */}
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                    <Languages className="w-4 h-4" />
                                    Languages
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Languages (comma-separated): English (Fluent), Spanish (Native)..."
                                    value={formData.languages.join(', ')}
                                    onChange={handleLanguagesChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    onClick={() => setShowGenerator(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || !formData.full_name || !formData.email}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {generating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Save & Generate PDF
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>How it works:</strong> Upload your PDF resume or create one using the builder.
                    The canonical text is extracted and used for auto-apply systems. PDFs are generated for
                    platforms that require attachments. Only one resume per account is used globally.
                </p>
            </div>
        </motion.div>
        </>
    );
};

export default ResumeSection;
