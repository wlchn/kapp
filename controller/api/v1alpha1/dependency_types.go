/*

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// DependencySpec defines the desired state of Dependency
type DependencySpec struct {
	// INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
	// Important: Run "make" to regenerate code after modifying this file

	// Foo is an example field of Dependency. Edit Dependency_types.go to remove/update

	Type    string            `json:"type"`
	Version string            `json:"version"`
	Config  map[string]string `json:"config,omitempty"`
}

// DependencyStatus defines the observed state of Dependency
type DependencyStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "make" to regenerate code after modifying this file
	Status string `json:"status"`
}

const (
	DependencyStatusNotInstalled  = "Not Installed"
	DependencyStatusInstallFailed = "Install Failed"
	DependencyStatusInstalling    = "Installing"
	DependencyStatusUninstalling  = "Uninstalling"
	DependencyStatusInstalled     = "Installed"
	DependencyStatusRunning       = "Running"
)

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Cluster
// +kubebuilder:subresource:status

// Dependency is the Schema for the dependencies API
type Dependency struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   DependencySpec   `json:"spec,omitempty"`
	Status DependencyStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Cluster

// DependencyList contains a list of Dependency
type DependencyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Dependency `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Dependency{}, &DependencyList{})
}
