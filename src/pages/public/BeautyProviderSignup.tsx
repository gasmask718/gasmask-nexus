import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Upload, Camera, Video, Shield, DollarSign, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'makeup', label: 'Makeup Artist', emoji: '💄' },
  { value: 'hair', label: 'Hairstylist', emoji: '💇' },
  { value: 'nails', label: 'Nail Technician', emoji: '💅' },
  { value: 'barber', label: 'Barber', emoji: '✂️' },
  { value: 'full_glam', label: 'Full Glam Team', emoji: '✨' },
];

const STEPS = ['Basic Info', 'Portfolio', 'Verification', 'Pricing', 'Review'];

export default function BeautyProviderSignup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [serviceRadius, setServiceRadius] = useState('25');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  // Step 2 - Portfolio
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);

  // Step 3 - Verification
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [confirmLicensed, setConfirmLicensed] = useState(false);

  // Step 4 - Pricing
  const [services, setServices] = useState<{ name: string; price: string; duration: string }[]>([
    { name: '', price: '', duration: '60' },
  ]);

  const toggleService = (val: string) => {
    setSelectedServices(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    );
  };

  const addServiceRow = () => {
    setServices(prev => [...prev, { name: '', price: '', duration: '60' }]);
  };

  const updateServiceRow = (idx: number, field: string, value: string) => {
    setServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeServiceRow = (idx: number) => {
    setServices(prev => prev.filter((_, i) => i !== idx));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return fullName && email && city && selectedServices.length > 0;
      case 1: return photos.length >= 5 && videos.length >= 1;
      case 2: return licenseFile && insuranceFile && confirmLicensed;
      case 3: return services.some(s => s.name && s.price);
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in first to submit your application.');
      return;
    }
    setLoading(true);
    try {
      const uid = user.id;
      const primaryCategory = selectedServices[0] === 'full_glam' ? 'makeup' : selectedServices[0];

      // Upload portfolio photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const path = `${uid}/portfolio/${Date.now()}-${photo.name}`;
        const { error } = await supabase.storage.from('beauty-provider-media').upload(path, photo);
        if (!error) {
          const { data: urlData } = supabase.storage.from('beauty-provider-media').getPublicUrl(path);
          photoUrls.push(urlData.publicUrl);
        }
      }

      // Upload videos
      const videoUrls: string[] = [];
      for (const video of videos) {
        const path = `${uid}/videos/${Date.now()}-${video.name}`;
        const { error } = await supabase.storage.from('beauty-provider-media').upload(path, video);
        if (!error) {
          const { data: urlData } = supabase.storage.from('beauty-provider-media').getPublicUrl(path);
          videoUrls.push(urlData.publicUrl);
        }
      }

      // Upload license
      let licenseUrl = '';
      if (licenseFile) {
        const path = `${uid}/docs/license-${Date.now()}-${licenseFile.name}`;
        const { error } = await supabase.storage.from('beauty-provider-media').upload(path, licenseFile);
        if (!error) {
          const { data: urlData } = supabase.storage.from('beauty-provider-media').getPublicUrl(path);
          licenseUrl = urlData.publicUrl;
        }
      }

      // Upload insurance
      let insuranceUrl = '';
      if (insuranceFile) {
        const path = `${uid}/docs/insurance-${Date.now()}-${insuranceFile.name}`;
        const { error } = await supabase.storage.from('beauty-provider-media').upload(path, insuranceFile);
        if (!error) {
          const { data: urlData } = supabase.storage.from('beauty-provider-media').getPublicUrl(path);
          insuranceUrl = urlData.publicUrl;
        }
      }

      // Create provider record
      const { data: provider, error: provErr } = await (supabase.from('beauty_providers') as any)
        .insert({
          name: fullName,
          business_name: businessName || null,
          phone,
          email,
          city,
          category: primaryCategory,
          service_radius_miles: parseInt(serviceRadius) || 25,
          specialties: selectedServices,
          bio,
          user_id: uid,
          verification_status: 'pending_verification',
          license_url: licenseUrl,
          insurance_url: insuranceUrl,
          independent_contractor: true,
        })
        .select('id')
        .single();

      if (provErr) throw provErr;
      const providerId = provider.id;

      // Insert portfolio media
      const mediaInserts = [
        ...photoUrls.map((url, i) => ({ provider_id: providerId, media_type: 'photo', url, display_order: i })),
        ...videoUrls.map((url, i) => ({ provider_id: providerId, media_type: 'video', url, display_order: i })),
      ];
      if (mediaInserts.length > 0) {
        await (supabase.from('provider_media') as any).insert(mediaInserts);
      }

      // Insert services
      const validServices = services.filter(s => s.name && s.price);
      if (validServices.length > 0) {
        await (supabase.from('provider_services') as any).insert(
          validServices.map(s => ({
            provider_id: providerId,
            service_name: s.name,
            price: parseFloat(s.price),
            duration_minutes: parseInt(s.duration) || 60,
          }))
        );
      }

      // Create application record
      await (supabase.from('beauty_provider_applications') as any).insert({
        provider_id: providerId,
        portfolio_photo_count: photoUrls.length,
        portfolio_video_count: videoUrls.length,
        license_uploaded: !!licenseUrl,
        insurance_uploaded: !!insuranceUrl,
      });

      toast.success('Application submitted! We will review your profile and get back to you.');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Join As A Beauty Specialist</h1>
          <p className="text-muted-foreground">Join our nationwide network of beauty professionals</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mb-6">{STEPS[step]}</p>

        {/* Step 1: Basic Info */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tell Us About Yourself</CardTitle>
              <CardDescription>Basic information to get you started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Full Name *</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" /></div>
                <div><Label>Business Name</Label><Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Optional" /></div>
                <div><Label>Phone Number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" /></div>
                <div><Label>Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
                <div><Label>City / Service Area *</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="Los Angeles, CA" /></div>
                <div><Label>Service Radius (miles)</Label><Input type="number" value={serviceRadius} onChange={e => setServiceRadius(e.target.value)} /></div>
              </div>
              <div>
                <Label>Bio / About You</Label>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell clients about your experience..." rows={3} />
              </div>
              <div>
                <Label className="mb-2 block">Service Types *</Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.map(st => (
                    <Badge
                      key={st.value}
                      variant={selectedServices.includes(st.value) ? 'default' : 'outline'}
                      className="cursor-pointer text-sm py-2 px-4"
                      onClick={() => toggleService(st.value)}
                    >
                      {st.emoji} {st.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Portfolio */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Portfolio Upload</CardTitle>
              <CardDescription>Showcase your best work — minimum 5 photos and 1 video required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4" /> Photos ({photos.length}/5 minimum)
                </Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => setPhotos(prev => [...prev, ...Array.from(e.target.files || [])])}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload photos</p>
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {photos.map((p, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {p.name.slice(0, 20)}
                        <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
                {photos.length < 5 && <p className="text-xs text-destructive mt-1">At least 5 photos required</p>}
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4" /> Videos ({videos.length}/1 minimum)
                </Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={e => setVideos(prev => [...prev, ...Array.from(e.target.files || [])])}
                    className="hidden"
                    id="video-upload"
                  />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload videos</p>
                  </label>
                </div>
                {videos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {videos.map((v, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {v.name.slice(0, 20)}
                        <button onClick={() => setVideos(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
                ⚠️ No applications accepted without a complete portfolio
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Verification */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> License & Insurance</CardTitle>
              <CardDescription>Upload your professional credentials for verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Professional License *</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setLicenseFile(e.target.files?.[0] || null)} className="hidden" id="license-upload" />
                  <label htmlFor="license-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{licenseFile ? licenseFile.name : 'Upload license document'}</p>
                  </label>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Insurance Document *</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setInsuranceFile(e.target.files?.[0] || null)} className="hidden" id="insurance-upload" />
                  <label htmlFor="insurance-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{insuranceFile ? insuranceFile.name : 'Upload insurance document'}</p>
                  </label>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox checked={confirmLicensed} onCheckedChange={(c) => setConfirmLicensed(!!c)} id="confirm-licensed" />
                <label htmlFor="confirm-licensed" className="text-sm cursor-pointer">
                  I confirm I am a licensed and insured professional. I understand that all credentials will be verified before my profile goes live.
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Pricing */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Pricing Setup</CardTitle>
              <CardDescription>Set your service prices and packages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map((svc, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <Label className="text-xs">Service Name</Label>}
                    <Input value={svc.name} onChange={e => updateServiceRow(i, 'name', e.target.value)} placeholder="e.g. Soft Glam" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className="text-xs">Price ($)</Label>}
                    <Input type="number" value={svc.price} onChange={e => updateServiceRow(i, 'price', e.target.value)} placeholder="120" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className="text-xs">Duration (min)</Label>}
                    <Input type="number" value={svc.duration} onChange={e => updateServiceRow(i, 'duration', e.target.value)} placeholder="60" />
                  </div>
                  <div className="col-span-1">
                    {services.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeServiceRow(i)} className="text-destructive">×</Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addServiceRow}>+ Add Service</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Review & Submit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {fullName}</div>
                <div><span className="text-muted-foreground">City:</span> {city}</div>
                <div><span className="text-muted-foreground">Email:</span> {email}</div>
                <div><span className="text-muted-foreground">Radius:</span> {serviceRadius} mi</div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Services: </span>
                {selectedServices.map(s => <Badge key={s} variant="secondary" className="mr-1">{s}</Badge>)}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Portfolio:</span> {photos.length} photos, {videos.length} videos
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Credentials:</span> License ✅ Insurance ✅
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Service Packages:</span> {services.filter(s => s.name).length} services listed
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground mt-4">
                <p className="font-medium text-foreground mb-1">Independent Contractor Disclosure</p>
                All beauty professionals operate as independent contractors and are responsible for their services. TopTier verifies credentials but does not directly employ providers.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
