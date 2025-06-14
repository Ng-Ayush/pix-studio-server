-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 08, 2025 at 08:33 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pixstudio`
--

-- --------------------------------------------------------

--
-- Table structure for table `ai_guests`
--

CREATE TABLE `ai_guests` (
  `id` int(11) NOT NULL,
  `guest_name` varchar(255) DEFAULT NULL,
  `guest_phone` varchar(20) DEFAULT NULL,
  `event_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billing_customer`
--

CREATE TABLE `billing_customer` (
  `id` int(11) NOT NULL,
  `party_name` varchar(255) NOT NULL,
  `phone_number` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `party_group` varchar(100) DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `billing_customer`
--

INSERT INTO `billing_customer` (`id`, `party_name`, `phone_number`, `email`, `party_group`, `billing_address`, `shipping_address`, `created_at`, `updated_at`) VALUES
(1, 'Ayush', '342343242', 'dsad@gmail.com', 'General', 'dsafsaffsa', '', '2025-06-01 07:41:15', '2025-06-01 07:41:15'),
(3, 'bitu', '32432423', 'czf@gmail.com', 'Retail', 'dfdsfkbdskfsd', '', '2025-06-01 08:09:47', '2025-06-01 08:09:47'),
(4, 'mxzcsfds', '248239', 'fdngkm@gaio.com', 'Wholesale', ' xclknvlksdofhe', '', '2025-06-01 08:10:06', '2025-06-01 08:10:06');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `customer_unique_id` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `customer_unique_id`, `created_by`) VALUES
(3, 'Aakash nigam', '2893131231', '215063', 2),
(11, 'Abhishek Srivastava', '7897909054', '214350', 1);

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `event_name` varchar(255) DEFAULT NULL,
  `is_ai_upload` tinyint(1) DEFAULT 0,
  `is_event_submitted` tinyint(1) DEFAULT 0,
  `customer_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `event_name`, `is_ai_upload`, `is_event_submitted`, `customer_id`) VALUES
(10, 'Shaadi', 1, 1, 11);

-- --------------------------------------------------------

--
-- Table structure for table `folders`
--

CREATE TABLE `folders` (
  `id` int(11) NOT NULL,
  `folder_name` varchar(255) DEFAULT NULL,
  `event_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `folders`
--

INSERT INTO `folders` (`id`, `folder_name`, `event_id`) VALUES
(62, 'Mehndi', 10),
(63, 'Haldi', 10);

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `party_id` int(11) NOT NULL,
  `status` varchar(50) DEFAULT 'unpaid',
  `total` decimal(10,2) NOT NULL,
  `balance_left` decimal(10,2) NOT NULL,
  `invoice_type` enum('sale','purchase') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `quantity` int(11) DEFAULT 1,
  `sale_price` decimal(10,2) DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `item_code` varchar(100) DEFAULT NULL,
  `item_category` varchar(100) DEFAULT NULL,
  `item_stock` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `photos`
--

CREATE TABLE `photos` (
  `id` int(11) NOT NULL,
  `photo_url` text DEFAULT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `folder_id` int(11) DEFAULT NULL,
  `photo_name` varchar(200) DEFAULT NULL,
  `is_selected` tinyint(1) DEFAULT 0,
  `is_favourite` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `photos`
--

INSERT INTO `photos` (`id`, `photo_url`, `uploaded_by`, `folder_id`, `photo_name`, `is_selected`, `is_favourite`) VALUES
(148, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fayush.jpeg?alt=media&token=bc3bbabb-1932-4b56-8b71-4474a6cfe092', NULL, 62, 'ayush.jpeg', 1, 0),
(149, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2FIMG_4583.png?alt=media&token=21a06eff-ade8-470d-aca0-d3d8d9fe743f', NULL, 62, 'IMG_4583.png', 0, 0),
(150, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fabc.png?alt=media&token=ab02f850-8f33-42b5-a5eb-43145547d009', NULL, 62, 'abc.png', 1, 1),
(151, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Flmn.png?alt=media&token=c8c20391-64ab-4a47-89bd-e9c3e438394e', NULL, 62, 'lmn.png', 0, 0),
(152, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fijk.png?alt=media&token=24eb9fbe-ec20-46e2-8973-e7c1bd3d3df6', NULL, 62, 'ijk.png', 1, 1),
(153, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fpexels-rakicevic-nenad-233369-1262304.jpg?alt=media&token=67e7a72f-0c9f-4e43-b299-cd66564ca2de', NULL, 62, 'pexels-rakicevic-nenad-233369-1262304.jpg', 0, 0),
(154, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fpexels-pawan-yadav-1321878-2577274.jpg?alt=media&token=eab6b59f-fae2-4f68-b289-c36979ea420f', NULL, 62, 'pexels-pawan-yadav-1321878-2577274.jpg', 0, 0),
(155, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fpexels-freestockpro-2070485.jpg?alt=media&token=fcbe0d1a-c1ed-4b91-a342-9a3ac8508ac2', NULL, 62, 'pexels-freestockpro-2070485.jpg', 0, 0),
(156, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fpexels-mohamedelaminemsiouri-2108845.jpg?alt=media&token=4ce920e8-c6d5-4791-8166-f1b8fc0caac4', NULL, 62, 'pexels-mohamedelaminemsiouri-2108845.jpg', 0, 0),
(157, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fopq.png?alt=media&token=d94a6827-11f8-424c-8e8a-f83403765034', NULL, 62, 'opq.png', 1, 0),
(158, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Frst.webp?alt=media&token=e5b48b5b-6ff6-4df2-af6e-cbc1b10e5709', NULL, 62, 'rst.webp', 0, 0),
(159, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FMehndi_62%2Fuvw.jpg?alt=media&token=acf8fa3b-c30b-464b-9dad-209e1535b33e', NULL, 62, 'uvw.jpg', 0, 0),
(160, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FHaldi_63%2Frst.webp?alt=media&token=4abc7ef7-eda6-461d-98bf-c0f250d4ca12', NULL, 63, 'rst.webp', 0, 0),
(161, 'https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/photos%2Fuser_null%2FAbhishek%20Srivastava_214350%2FShaadi_10%2FHaldi_63%2Fuvw.jpg?alt=media&token=c91874b1-0fdf-4f72-98a9-be5ecc914fbc', NULL, 63, 'uvw.jpg', 1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `photo_selections`
--

CREATE TABLE `photo_selections` (
  `id` int(11) NOT NULL,
  `photo_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `event_id` int(11) DEFAULT NULL,
  `is_selected` tinyint(1) DEFAULT 0,
  `is_favorite` tinyint(1) DEFAULT 0,
  `selected_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone_number` varchar(15) NOT NULL,
  `pin` char(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone_number`, `pin`) VALUES
(1, 'Ayush Srivastava', 'ayush1011@gmail.com', '+917897909054', '739948'),
(2, 'Bittu Baba', 'ayush@gmail.com', '+917897909054', '123456');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ai_guests`
--
ALTER TABLE `ai_guests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`);

--
-- Indexes for table `billing_customer`
--
ALTER TABLE `billing_customer`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_unique_id` (`customer_unique_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `folders`
--
ALTER TABLE `folders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `party_id` (`party_id`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `photos`
--
ALTER TABLE `photos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `folder_id` (`folder_id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `photo_selections`
--
ALTER TABLE `photo_selections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `photo_id` (`photo_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `event_id` (`event_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `pin` (`pin`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ai_guests`
--
ALTER TABLE `ai_guests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billing_customer`
--
ALTER TABLE `billing_customer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `folders`
--
ALTER TABLE `folders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `photos`
--
ALTER TABLE `photos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=162;

--
-- AUTO_INCREMENT for table `photo_selections`
--
ALTER TABLE `photo_selections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ai_guests`
--
ALTER TABLE `ai_guests`
  ADD CONSTRAINT `ai_guests_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `folders`
--
ALTER TABLE `folders`
  ADD CONSTRAINT `folders_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`party_id`) REFERENCES `billing_customer` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `photos`
--
ALTER TABLE `photos`
  ADD CONSTRAINT `photos_ibfk_1` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `photos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `photo_selections`
--
ALTER TABLE `photo_selections`
  ADD CONSTRAINT `photo_selections_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `photo_selections_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `photo_selections_ibfk_3` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
