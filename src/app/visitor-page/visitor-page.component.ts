import {
  Component,
  AfterViewInit,
  OnDestroy,
  Renderer2,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';
import { popiaQuestions } from './popia.questions';
import { HttpClient } from '@angular/common/http';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-visitor-page',
  templateUrl: './visitor-page.component.html',
  styleUrls: ['./visitor-page.component.scss'],
})
export class VisitorPageComponent implements AfterViewInit, OnDestroy {
  private navigationSubscription: Subscription | undefined;
  questions = popiaQuestions;
  private isDrawing = false;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // Visitor data
  name: string = '';
  surname: string = '';
  contact: string = '';
  email: string = '';
  idn: string = '';
  purpose: string = '';
  date: string = '';
  organization: string = '';
  signatureImage: string | null = null;
  selfieImage: string | null = null;
  acceptedPOPIA: boolean = false;

  // New properties for custom reason
  otherReason: string = ''; // Holds custom reason input
  isOtherReasonVisible: boolean = false; // Tracks visibility of other reason input
  previousVisitorData: any | null = null; // New property to store previous visitor data

  constructor(
    private renderer: Renderer2,
    private router: Router,
    private toastController: ToastController,
    private cdRef: ChangeDetectorRef,
    private http: HttpClient // Inject HttpClient
  ) {}

  // Method called when POPIA acceptance changes
  onPOPIAAccepted(accepted: boolean) {
    this.acceptedPOPIA = accepted;
    if (accepted) {
      this.enableFormFields();
      this.hideModal();
    }
  }

  // Check if visitor exists by name and surname
  checkVisitor(name: string, surname: string): Observable<any> {
    return this.http.get(
      `http://10.0.0.175:3000/api/visitors/check?name=${name}&surname=${surname}`
    );
  }

  // Method called when the name changes
  onNameChange() {
    this.checkVisitorData();
  }

  // Method called when the surname changes
  onSurnameChange() {
    this.checkVisitorData();
  }

  private checkVisitorData() {
    this.checkIfVisitorExistsByNameAndSurname(this.name, this.surname);
  }

  private async checkIfVisitorExistsByNameAndSurname(
    name: string,
    surname: string
  ): Promise<void> {
    if (!name || !surname) {
      return; // Early exit if either name or surname is not provided
    }

    this.checkVisitor(name, surname).subscribe({
      next: (response: { exists: boolean; visitor?: any }) => {
        console.log('Response from server:', response); // Debugging line
        if (response.exists) {
          this.presentToast(
            'User already exists. Please use your previously submitted information to fill in the form.'
          );
          // Populate the form with the existing visitor data
          this.previousVisitorData = response.visitor; // Store previous visitor data for autofill
          this.showAutofillConfirmationModal(response.visitor); // Show modal to confirm autofill
        } else {
          console.log('User does not exist.'); // Debugging line
        }
      },
      error: (err) => {
        console.error('Error checking visitor existence:', err);
        this.presentToast(
          'An error occurred while checking visitor existence. Please try again.'
        );
      },
    });
  }

  private showAutofillConfirmationModal(visitor: any) {
    const modalElement = document.getElementById('autofillConfirmationModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement); // Create a new Bootstrap modal
      modal.show();
    } else {
      console.error('Modal element not found');
    }
  }

  // Autofill form with previous visitor data
  public autofillForm() {
    if (this.previousVisitorData) {
      this.name = this.previousVisitorData.name;
      this.surname = this.previousVisitorData.surname;
      this.contact = this.previousVisitorData.contact;
      this.idn = this.previousVisitorData.idn;
      this.email = this.previousVisitorData.email;
      this.organization = this.previousVisitorData.organization;
      // Add any other fields you want to autofill
    }
  }

  // Handles selfie input change
  handleSelfieChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate if the file is an image
      if (!file.type.startsWith('image/')) {
        this.presentToast('Please upload a valid image file.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = (loadEvent) => {
        const img = new Image();
        img.src = loadEvent.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (ctx) {
            const maxWidth = 800;
            const maxHeight = 800;
            let width = img.width;
            let height = img.height;

            // Maintain aspect ratio
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Convert canvas to base64
            this.selfieImage = canvas.toDataURL('image/jpeg'); // Save selfie image

            // Debugging line to log the selfie image data length
            console.log('Selfie image data length:', this.selfieImage.length);

            // Optionally, you can also log a small part of the image data for verification
            console.log(
              'Selfie image data preview:',
              this.selfieImage.substring(0, 30)
            );
          } else {
            console.error('Failed to get canvas context');
            this.presentToast('Unable to process the image. Please try again.');
          }
        };
      };
      reader.readAsDataURL(file);
    }
  }

  // This method gets called when the purpose of the visit changes
  onPurposeChange() {
    this.isOtherReasonVisible = this.purpose === 'Other';
  }

  // Validate form fields
  isFormValid(): boolean {
    return (
      this.name.trim() !== '' &&
      this.surname.trim() !== '' &&
      this.contact.trim().length === 10 && // Adjust length check as needed
      this.idn.trim().length === 13 &&
      this.email.trim() !== '' &&
      this.purpose.trim() !== '' &&
      (this.purpose !== 'Other' || this.otherReason.trim() !== '') &&
      this.organization.trim() !== '' && // Ensure organization is not empty
      this.acceptedPOPIA // Ensure POPIA is accepted
    );
  }

  // Handle form submission
  onSubmit() {
    // Check if the user accepted the POPIA terms
    if (!this.acceptedPOPIA) {
      this.presentToast('You must accept the POPIA terms to proceed.');
      return;
    }

    // Trim contact number to 10 digits
    if (this.contact.length > 10) {
      this.contact = this.contact.substring(0, 10);
    } else if (this.contact.length < 10) {
      this.presentToast('Invalid Contact: Must contain exactly 10 digits');
      return;
    }

    // Validate form fields
    const errorMessages: string[] = this.validateForm();
    if (errorMessages.length > 0) {
      this.presentToast(errorMessages.join(' '));
      return;
    }

    // Determine the reason for the visit
    const reasonForVisit =
      this.purpose === 'Other' ? this.otherReason : this.purpose;
    const date_of_entry = new Date().toISOString(); // Use ISO format for date

    // Prepare the visitor data object
    const visitorData = {
      name: this.name,
      surname: this.surname,
      contact: this.contact,
      email: this.email,
      idn: this.idn,
      purpose: reasonForVisit,
      date_of_entry: date_of_entry,
      organization: this.organization,
      signatureImage: this.signatureImage, // Make sure signatureImage is captured
      selfieImage: this.selfieImage, // Make sure selfieImage is captured
      acceptedPOPIA: this.acceptedPOPIA,
    };

    // Log selfie and signature images for debugging
    console.log('Selfie Image:', this.selfieImage);
    console.log('Signature Image:', this.signatureImage);

    // Make the HTTP POST request to the backend
    this.http
      .post('http://10.0.0.175:3000/api/visitors', visitorData)
      .subscribe({
        next: (response) => {
          console.log('Visitor data submitted successfully:', response);
          this.showSuccessModal();
          setTimeout(() => {
            this.router.navigate(['/home']); // Navigate after a delay
          }, 2000); // Adjust the delay as needed
        },
        error: (err) => {
          console.error('Error submitting visitor data:', err);
          this.presentToast(
            'An error occurred while submitting data. Please try again.'
          );
        },
      });
  }

  // Validation for the form fields
  private validateForm(): string[] {
    const messages: string[] = [];
    if (!this.name.trim()) messages.push('Name is required.');
    if (!this.surname.trim()) messages.push('Surname is required.');
    if (!this.email.trim()) messages.push('Email Address is required.');
    if (!this.idn.trim()) messages.push('id number is required');
    if (!this.purpose.trim()) messages.push('Purpose of Visit is required.');
    if (this.purpose === 'Other' && !this.otherReason.trim())
      messages.push('Please specify the Other Reason.');
    if (!this.organization.trim()) messages.push('Organization is required.');
    return messages;
  }

  ngAfterViewInit() {
    this.showModal();
    this.setupCanvas();

    const acceptButton = document.getElementById('acceptPOPIA');
    const cancelButton = document.querySelector('.btn-secondary');
    const closeButton = document.querySelector('.btn-close');

    if (acceptButton) {
      acceptButton.addEventListener('click', () => this.onPOPIAAccepted(true));
    }
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.handleCancelOrClose());
    }
    if (closeButton) {
      closeButton.addEventListener('click', () => this.handleCancelOrClose());
    }

    this.cdRef.detectChanges();
  }

  // Show popups
  showModal() {
    const modal = document.getElementById('popiaModal');
    if (modal) {
      this.renderer.addClass(modal, 'show');
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden', 'false');
      this.cdRef.detectChanges();
    }
  }

  // Hide the pop up from the screen
  hideModal() {
    const modal = document.getElementById('popiaModal');
    if (modal) {
      this.renderer.removeClass(modal, 'show');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // Enable form fields
  enableFormFields() {
    const formFields = document.querySelectorAll('.form-control');
    formFields.forEach((field) => {
      (field as HTMLInputElement).disabled = false;
    });
  }

  // Handling the close and cancel clicks
  async handleCancelOrClose() {
    await this.router.navigateByUrl('/home', {
      state: { message: 'POPIA terms must be accepted to continue.' },
    });
  }

  // Method to show the toast
  async presentToast(message: string, isSuccess: boolean = false) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      cssClass: 'success-toast',
      icon: isSuccess ? 'checkmark-circle' : '', // Use a success icon for successful messages
    });
    await toast.present();
  }

  ngOnDestroy() {
    this.cleanupEventListeners();
    this.navigationSubscription?.unsubscribe();
  }

  // Cleanup event listeners
  private cleanupEventListeners() {
    const acceptButton = document.getElementById('acceptPOPIA');
    const cancelButton = document.querySelector('.btn-secondary');
    const closeButton = document.querySelector('.btn-close');

    if (acceptButton) {
      acceptButton.removeEventListener('click', () =>
        this.onPOPIAAccepted(true)
      );
    }
    if (cancelButton) {
      cancelButton.removeEventListener('click', () =>
        this.handleCancelOrClose()
      );
    }
    if (closeButton) {
      closeButton.removeEventListener('click', () =>
        this.handleCancelOrClose()
      );
    }
  }

  // Setup for the canvas
  private setupCanvas() {
    this.canvas = document.getElementById(
      'signatureCanvas'
    ) as HTMLCanvasElement;
    if (!this.canvas) return; // Ensure canvas element exists
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.width = 400; // Set your desired width
    this.canvas.height = 150; // Set your desired height
    this.ctx.lineWidth = 2; // Set line width
    this.ctx.lineCap = 'round'; // Round line caps
    this.ctx.strokeStyle = 'black'; // Line color

    // Setup pointer event listeners for drawing
    this.canvas.addEventListener('pointerdown', (event) =>
      this.startDrawing(event)
    );
    this.canvas.addEventListener('pointermove', (event) => this.draw(event));
    this.canvas.addEventListener('pointerup', () => this.stopDrawing());
    this.canvas.addEventListener('pointerout', () => this.stopDrawing());

    // Optional: Prevent scrolling when drawing on mobile devices
    this.canvas.addEventListener(
      'touchstart',
      (event) => event.preventDefault(),
      { passive: false }
    );
    this.canvas.addEventListener(
      'touchmove',
      (event) => event.preventDefault(),
      { passive: false }
    );
  }

  // Start drawing on the canvas
  private startDrawing(event: PointerEvent) {
    this.isDrawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(
      event.clientX - this.canvas.getBoundingClientRect().left,
      event.clientY - this.canvas.getBoundingClientRect().top
    );
  }

  // Draw on the canvas
  private draw(event: PointerEvent) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left; // Calculate x position
    const y = event.clientY - rect.top; // Calculate y position

    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  // Example for capturing signature
  stopDrawing() {
    this.isDrawing = false;
    this.ctx.closePath();
    // Capture signature image when drawing stops
    this.signatureImage = this.canvas.toDataURL(); // Ensure this captures the signature
    console.log('Signature image data:', this.signatureImage); // Debugging line
  }

  // Show success modal
  async showSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
      this.renderer.addClass(modal, 'show');
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden', 'false');
      this.cdRef.detectChanges();
    }
  }
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  onSuccessModalShown() {
    // Automatically redirect to the saved details page after 3 seconds
    setTimeout(() => {
      this.redirectToSavedDetails();
    }, 3000);
  }

  redirectToSavedDetails() {
    // Redirect to the saved details page
    this.router.navigate(['/home']);
  }

  handleBackNavigation() {
    // Navigate to the visitor registration page with a forced refresh
    this.router
      .navigate(['/visitor-registration'], { replaceUrl: true })
      .then(() => {
        window.location.reload();
      });
  }
}
