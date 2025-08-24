<template>
    <div class="min-h-screen p-6 bg-cream flex flex-col items-center">

        <!-- Logo + Form (centered vertically) -->
        <div class="flex flex-col items-center justify-center flex-grow">

            <!-- Logo -->
            <div class="flex flex-col items-center mb-10">
                <img src="../assets/logo.png" alt="Car Dealers Finder Logo" class="w-40 h-40 mb-4 drop-shadow-lg" />
                <p class="text-2xl font-semibold text-gray-800 text-center max-w-2xl">
                    Connecting you to trusted car dealers in seconds.
                </p>
            </div>

            <!-- Search Form Container -->
            <div class="max-w-xl w-full p-6 bg-cream-light border border-red-800 rounded-[20px] shadow-lg">
                <div class="space-y-4">

                    <!-- Car Brand (Autocomplete) -->
                    <label for="carBrand" class="block mb-1 font-medium text-gray-800">Car Brand</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <TruckIcon class="w-5 h-5 text-gray-500" />

                        </span>
                        <input id="carBrand" v-model="carBrandInput" @input="filterBrands" @blur="validateCarBrand"
                            type="text" placeholder="Type to search..."
                            class="w-full p-3 pl-10 border border-red-800 rounded-[15px] bg-cream-light text-black focus:outline-none focus:ring-2 focus:ring-red-800" />

                        <!-- Suggestions -->
                        <ul v-if="filteredBrands.length > 0 && showSuggestions"
                            class="absolute left-0 mt-1 w-full bg-red-50 border border-red-800 rounded-[15px] shadow-lg z-20 overflow-hidden">
                            <li v-for="brand in filteredBrands" :key="brand" @mousedown.prevent="selectBrand(brand)"
                                class="p-3 cursor-pointer transition-colors hover:bg-red-800 hover:text-white">
                                {{ brand }}
                            </li>
                        </ul>
                    </div>

                    <!-- Search By -->
                    <label for="searchBy" class="block mb-1 font-medium text-gray-800">Search By</label>
                    <Listbox v-model="searchBy">
                        <div class="relative">
                            <ListboxButton id="searchBy"
                                class="w-full p-3 border border-red-800 rounded-[15px] bg-cream-light text-black flex justify-between items-center">
                                <span class="flex items-center gap-2">
                                    <MapPinIcon class="w-5 h-5 text-gray-500" />
                                    {{ searchBy }}
                                </span>
                                <ChevronDownIcon class="w-5 h-5 text-gray-500" />
                            </ListboxButton>
                            <ListboxOptions
                                class="absolute left-0 mt-1 w-full bg-cream-light border border-red-800 rounded-[15px] shadow-lg z-20 overflow-hidden">
                                <ListboxOption v-for="option in searchOptions" :key="option" :value="option"
                                    v-slot="{ active, selected }">
                                    <li class="p-3 cursor-pointer transition-colors" :class="[
                                        active ? 'bg-red-800 text-white' : 'bg-red-50 text-black',
                                        selected ? 'font-semibold' : 'font-normal'
                                    ]">
                                        {{ option }}
                                    </li>
                                </ListboxOption>
                            </ListboxOptions>
                        </div>
                    </Listbox>

                    <!-- Conditional Input -->
                    <div v-if="searchBy === 'City'" class="relative">
                        <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <MapPinIcon class="w-5 h-5 text-gray-500" />
                        </span>
                        <input v-model="city" type="text" placeholder="Enter City"
                            class="w-full p-3 pl-10 rounded-[15px] border border-red-800 bg-cream-light text-black focus:outline-none focus:ring-2 focus:ring-red-800"
                            @input="validateCity" />
                    </div>
                    <div v-else>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <MapPinIcon class="w-5 h-5 text-gray-500" />
                            </span>
                            <input v-model="postalCode" type="text" placeholder="Enter Postal Code"
                                class="w-full p-3 pl-10 rounded-[15px] border border-red-800 bg-cream-light text-black focus:outline-none focus:ring-2 focus:ring-red-800"
                                @input="validatePostalCode" />
                        </div>
                        <label class="block mt-2 font-medium">Distance Radius: {{ distanceRadius }} km</label>
                        <input type="range" min="0" max="50" v-model="distanceRadius" class="w-full accent-red-800" />
                    </div>

                    <div class="flex justify-center gap-3 mt-4">

                        <!-- Search Button -->
                        <button @click="onSearch" :disabled="isSearchDisabled" class="w-60 p-3 rounded-[15px] font-semibold shadow-md transition-colors
                         disabled:bg-gray-300 disabled:text-gray-700
                         bg-red-800 text-white hover:bg-red-900 flex items-center justify-center gap-2">
                            <MagnifyingGlassIcon class="w-5 h-5" /> Search
                        </button>

                        <!-- Reset button, only shows after searching -->
                        <button v-if="hasSearched" @click="resetForm" class="w-60 p-3 rounded-[15px] font-semibold shadow-md transition-colors
                        bg-gray-300 text-gray-700 hover:bg-gray-400 flex items-center justify-center gap-2">
                            <XMarkIcon class="w-5 h-5" /> Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dealers List -->
        <div v-if="dealers.length > 0 || loading" class="max-w-xl w-full mt-8 space-y-4">

            <!-- Skeleton Loader -->
            <div v-if="loading" v-for="(_, idx) in skeletons" :key="idx"
                class="p-4 border rounded-[15px] bg-white shadow animate-pulse">
                <div class="h-6 bg-gray-300 rounded mb-2 w-1/3"></div>
                <div class="h-4 bg-gray-300 rounded mb-1 w-2/3"></div>
                <div class="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>

            <!-- Real Dealers -->
            <div v-for="dealer in visibleDealers" :key="dealer._id" class="p-4 border rounded-[15px] bg-white shadow">
                <h2 class="font-bold text-lg flex items-center gap-2">
                    <BuildingOfficeIcon class="w-5 h-5 text-gray-500" /> {{ dealer.name }}
                </h2>
                <p>{{ dealer.street }}, {{ dealer.postalCode }} {{ dealer.city }}</p>
                <p v-if="dealer.phone">📞 {{ dealer.phone }}</p>
                <a v-if="dealer.website" :href="dealer.website" target="_blank" class="text-blue-600">Website</a>
                <p v-if="dealer.services?.length">Services: {{ dealer.services.join(', ') }}</p>
            </div>

            <!-- Load More button -->
            <button v-if="visibleDealers.length < dealers.length" @click="loadMore"
                class="w-full p-3 bg-red-800 text-white rounded-[15px] font-semibold shadow-md hover:bg-red-900">
                Load More..
            </button>

            <!-- Download Results -->
            <button v-if="dealers.length" @click="showDownloadPopup = true"
                class="w-full p-3 bg-red-800 text-white rounded-[15px] font-semibold shadow-md hover:bg-red-900 mt-4 flex items-center justify-center gap-2">
                <ArrowDownTrayIcon class="w-5 h-5" /> Download Results
            </button>
        </div>

        <!-- No Results Popup -->
        <div v-if="showNoResults" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div class="bg-white p-6 rounded-[15px] max-w-sm text-center shadow-lg">
                <p>No dealers found nearby. Try increasing your search radius or choosing a different location.</p>
                <button @click="showNoResults = false"
                    class="mt-4 p-2 bg-red-800 text-white rounded-[15px] hover:bg-red-900">
                    Okay
                </button>
            </div>
        </div>

        <!-- Download Popup -->
        <div v-if="showDownloadPopup" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div class="bg-white p-6 rounded-[15px] max-w-md w-full shadow-lg">
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                    <ArrowDownTrayIcon class="w-6 h-6 text-red-700" /> Download Results
                </h3>
                <div class="flex gap-4 mb-4">

                    <!-- File name input -->
                    <div class="flex-1">
                        <label class="block font-medium mb-1">File Name</label>
                        <input v-model="downloadFileName" type="text"
                            class="w-full p-2 border border-red-800 rounded-[10px]" />
                    </div>

                    <!-- File type select -->
                    <div class="flex-1 relative">
                        <label class="block font-medium mb-1">File Type</label>
                        <Listbox v-model="downloadFileType">
                            <div class="relative">
                                <ListboxButton
                                    class="w-full p-2 border border-red-800 rounded-[10px] bg-cream-light text-black flex justify-between items-center">
                                    {{ downloadFileType }}
                                    <ChevronDownIcon class="w-5 h-5 text-gray-500" />
                                </ListboxButton>
                                <ListboxOptions
                                    class="absolute left-0 mt-1 w-full bg-cream-light border border-red-800 rounded-[15px] shadow-lg z-20 overflow-hidden">
                                    <ListboxOption v-for="option in downloadOptions" :key="option" :value="option"
                                        v-slot="{ active, selected }">
                                        <li class="p-3 cursor-pointer transition-colors" :class="[
                                            active ? 'bg-red-800 text-white' : 'bg-red-50 text-black',
                                            selected ? 'font-semibold' : 'font-normal'
                                        ]">
                                            {{ option }}
                                        </li>
                                    </ListboxOption>
                                </ListboxOptions>
                            </div>
                        </Listbox>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-4">

                    <!-- Cancel button -->
                    <button @click="showDownloadPopup = false"
                        class="px-4 py-2 bg-gray-300 text-gray-700 rounded-[10px] hover:bg-gray-400 flex items-center gap-2">
                        <XMarkIcon class="w-5 h-5" /> Cancel
                    </button>

                    <!-- Download button -->
                    <button @click="downloadResults"
                        class="px-4 py-2 bg-red-800 text-white rounded-[10px] hover:bg-red-900 flex items-center gap-2">
                        <CheckIcon class="w-5 h-5" /> Download
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>


<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import axios from "axios";
import * as XLSX from "xlsx";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
import {
    MagnifyingGlassIcon,
    MapPinIcon,
    BuildingOfficeIcon,
    ChevronDownIcon,
    CheckIcon,
    TruckIcon,
    ArrowDownTrayIcon,
    XMarkIcon
} from "@heroicons/vue/24/solid";

export default defineComponent({
    components: {
        Listbox,
        ListboxButton,
        ListboxOption,
        ListboxOptions,
        MagnifyingGlassIcon,
        MapPinIcon,
        BuildingOfficeIcon,
        ChevronDownIcon,
        CheckIcon,
        TruckIcon,
        ArrowDownTrayIcon,
        XMarkIcon,
    },
    setup() {
        // --- Car brand autocomplete ---
        const brands = ["Kia", "Opel"];
        const carBrand = ref(""); // confirmed brand
        const carBrandInput = ref(""); // what user types
        const filteredBrands = ref<string[]>([]);
        const showSuggestions = ref(false);

        function filterBrands() {
            showSuggestions.value = true;
            filteredBrands.value = brands.filter(b =>
                b.toLowerCase().includes(carBrandInput.value.toLowerCase())
            );
        }

        function selectBrand(brand: string) {
            carBrand.value = brand;
            carBrandInput.value = brand;
            showSuggestions.value = false;
        }

        function validateCarBrand() {
            if (!brands.includes(carBrandInput.value)) {
                carBrandInput.value = "";
                carBrand.value = "";
            }
            showSuggestions.value = false;
        }

        // --- Search ---
        const searchBy = ref("City");
        const searchOptions = ["City", "Postal Code"];
        const city = ref("");
        const postalCode = ref("");
        const distanceRadius = ref(5);

        const dealers = ref<any[]>([]);
        const visibleCount = ref(2);
        const showNoResults = ref(false);

        const visibleDealers = computed(() => dealers.value.slice(0, visibleCount.value));

        function validateCity() {
            city.value = city.value.replace(/[^a-zA-ZäöüÄÖÜß\s]/g, "");
        }
        function validatePostalCode() {
            postalCode.value = postalCode.value.replace(/\D/g, "");
        }

        const isSearchDisabled = computed(() => {
            if (!carBrand.value) return true;
            if (searchBy.value === "City") return city.value.trim() === "";
            else return postalCode.value.trim() === "";
        });

        async function searchDealers() {
            loading.value = true;
            showNoResults.value = false;
            dealers.value = [];
            

            const query: any = { brand: carBrand.value };
            if (searchBy.value === "City") query.city = city.value;
            else {
                query.postalCode = postalCode.value;
                query.radius = distanceRadius.value;
            }

            try {
                // const res = await axios.get("http://localhost:3000/api/dealers", { params: query });
                const [res] = await Promise.all([
                    axios.get("http://localhost:3000/api/dealers", { params: query }),
                    new Promise(resolve => setTimeout(resolve, 2000)) // 2s delay
                ]);
                if (res.data.length === 0) showNoResults.value = true;
                else {
                    dealers.value = res.data;
                }
            } catch (err) {
                console.error(err);
                showNoResults.value = true;
            } finally {
                loading.value = false;
            }
        }

        function loadMore() {
            visibleCount.value += 2;
        }

        // --- Sekeleton Loader ---
        const loading = ref(false);

        // This array is used to render skeletons while loading
        const skeletons = Array.from({ length: 5 });

        // --- Reset Form ---
        const hasSearched = ref(false);

        function onSearch() {
            hasSearched.value = true; // mark that user searched
            searchDealers();           // call your existing search function
        }

        function resetForm() {
            // Reset all form fields
            carBrand.value = "";
            carBrandInput.value = "";
            city.value = "";
            postalCode.value = "";
            distanceRadius.value = 5;
            searchBy.value = "City";

            // Clear results
            dealers.value = [];
            visibleCount.value = 10;

            // Hide Reset button
            hasSearched.value = false;
        }

        // --- Download popup ---
        const showDownloadPopup = ref(false);
        const downloadOptions = ["xlsx", "csv"];
        const downloadFileName = ref("dealers");
        const downloadFileType = ref("xlsx");

        function downloadResults() {
            const fileName = downloadFileName.value || "dealers";

            //sanitizing dealers before creating excel files
            const sanitizedData = dealers.value.map(({ inactive, location, ...rest }) => rest);

            if (downloadFileType.value === "xlsx") {
                const ws = XLSX.utils.json_to_sheet(sanitizedData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Dealers");
                XLSX.writeFile(wb, `${fileName}.xlsx`);
            } else {
                const ws = XLSX.utils.json_to_sheet(sanitizedData);
                const csv = XLSX.utils.sheet_to_csv(ws);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `${fileName}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            showDownloadPopup.value = false;
        }

        return {
            brands,
            carBrand,
            carBrandInput,
            filteredBrands,
            showSuggestions,
            filterBrands,
            selectBrand,
            validateCarBrand,
            searchBy,
            searchOptions,
            hasSearched,
            resetForm,
            onSearch,
            city,
            postalCode,
            distanceRadius,
            dealers,
            visibleDealers,
            showNoResults,
            searchDealers,
            loadMore,
            isSearchDisabled,
            loading,
            skeletons,
            showDownloadPopup,
            downloadOptions,
            downloadFileName,
            downloadFileType,
            downloadResults,
            validateCity,
            validatePostalCode
        };
    },
});
</script>